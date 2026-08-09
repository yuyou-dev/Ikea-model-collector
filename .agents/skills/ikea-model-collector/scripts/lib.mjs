import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { isIP } from "node:net";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const MAX_BYTES = 256 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const COLLECTION_SCHEMA = "ikea_model_collection.v1";
export const CAPTURE_SCHEMA = "ikea_product_capture.v1";
const TERMS_DEFAULT = "https://www.ikea.com/us/en/customer-service/terms-conditions/";
const ATTEMPT_RESULTS = new Set(["model_unavailable", "discovery_failed", "capture_failed", "validation_failed"]);

export function assertSafeId(value, label = "id") {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new Error(`${label} must use lowercase letters, digits, and hyphens.`);
  return value;
}

export function contained(root, path, label = "path") {
  const base = resolve(root);
  const target = resolve(path);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error(`${label} escapes its allowed directory.`);
  return target;
}

function privateIpv4(host) {
  const p = host.split(".").map(Number); if (p.length !== 4) return false;
  const [a,b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export function assertPublicHttps(value, label = "URL") {
  let url; try { url = new URL(value); } catch { throw new Error(`${label} must be a valid HTTPS URL.`); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${label} must be HTTPS without credentials.`);
  if (!host || host === "localhost" || host.endsWith(".localhost") || (isIP(host) === 4 && privateIpv4(host)) || (isIP(host) === 6 && (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8")))) throw new Error(`${label} must use a public host.`);
  return url;
}

export function assertProductUrl(value) {
  const url = assertPublicHttps(value, "Product URL");
  if (url.hostname !== "ikea.com" && !url.hostname.endsWith(".ikea.com")) throw new Error("Product URL must be hosted by IKEA.");
  return url;
}

export function assertModelUrl(value) {
  const url = assertPublicHttps(value, "Model URL");
  const host = url.hostname.toLowerCase(), path = url.pathname.toLowerCase();
  if (host !== "ikea.com" && !host.endsWith(".ikea.com")) throw new Error("Model URL must use an IKEA host.");
  if (!path.includes("/dimma/assets/") || (!path.endsWith(".glb") && !path.includes("/glb_draco/"))) throw new Error("Model URL must be an observed IKEA DIMMA GLB asset.");
  return url;
}

function parseJsonChunk(buffer) {
  try {
    const json = JSON.parse(buffer.toString("utf8").replace(/[\u0000 ]+$/g, ""));
    return { extensionsUsed: json.extensionsUsed ?? [], extensionsRequired: json.extensionsRequired ?? [] };
  } catch { throw new Error("GLB contains an invalid JSON chunk."); }
}

export function validateGlb(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "glTF") throw new Error("Invalid GLB magic header.");
  const version = buffer.readUInt32LE(4), declared = buffer.readUInt32LE(8);
  if (version !== 2) throw new Error(`Unsupported GLB version: ${version}.`);
  if (declared !== buffer.length) throw new Error(`GLB declared length ${declared} does not match ${buffer.length} bytes.`);
  let extensions = { extensionsUsed: [], extensionsRequired: [] };
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4), end = offset + 8 + length;
    if (end > buffer.length) throw new Error("GLB chunk exceeds its declared file length.");
    if (type === 0x4e4f534a) { extensions = parseJsonChunk(buffer.subarray(offset + 8, end)); break; }
    offset = end;
  }
  return { version, bytes: buffer.length, ...extensions };
}

async function validateGlbFile(path) {
  const file = await open(path, "r");
  try { const size = (await file.stat()).size; if (size > MAX_BYTES) throw new Error(`GLB exceeds ${MAX_BYTES} bytes.`); return validateGlb(await file.readFile()); }
  finally { await file.close(); }
}

function atomic(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.partial-${randomUUID()}`;
  try { writeFileSync(tmp, data, { flag: "wx", mode: 0o600 }); renameSync(tmp, path); }
  catch (error) { rmSync(tmp, { force: true }); throw error; }
}
function json(path, value) { atomic(path, `${JSON.stringify(value, null, 2)}\n`); }
function sha(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

export function collectionDir(collectionId, projectDir = process.cwd()) {
  assertSafeId(collectionId, "collection id");
  return contained(resolve(projectDir, ".ikea-model-collector", "collections"), resolve(projectDir, ".ikea-model-collector", "collections", collectionId), "collection path");
}

function requireCollection(collectionId, projectDir) {
  const dir = collectionDir(collectionId, projectDir), path = join(dir, "collection.json");
  if (!existsSync(path)) throw new Error(`Collection does not exist: ${collectionId}`);
  return { dir, path, collection: JSON.parse(readFileSync(path, "utf8")) };
}

function assets(dir) {
  const md = join(dir, "metadata");
  return existsSync(md) ? readdirSync(md).filter(n => n.endsWith(".json")).sort().map(n => JSON.parse(readFileSync(join(md, n), "utf8"))) : [];
}

export function initCollection({ collectionId, name = collectionId, locale, termsUrl = TERMS_DEFAULT, acknowledgeTerms, projectDir = process.cwd() }) {
  if (acknowledgeTerms !== true) throw new Error("init requires --acknowledge-terms; this records acknowledgment but does not grant rights.");
  if (!locale) throw new Error("locale is required.");
  const terms = assertPublicHttps(termsUrl, "Terms URL").toString();
  const dir = collectionDir(collectionId, projectDir), path = join(dir, "collection.json");
  if (existsSync(path)) return showCollection({ collectionId, projectDir });
  for (const folder of ["assets", "metadata", "previews"]) mkdirSync(join(dir, folder), { recursive: true });
  const now = new Date().toISOString();
  json(path, { schemaVersion: COLLECTION_SCHEMA, collectionId, name, locale, termsAcknowledgment: { acknowledged: true, acknowledgedAt: now, termsUrl: terms }, createdAt: now, updatedAt: now });
  return showCollection({ collectionId, projectDir });
}

async function streamToFile(input, destination, limit, label) {
  const temp = `${destination}.partial-${randomUUID()}`; let size = 0; const digest = createHash("sha256");
  const meter = new Transform({ transform(chunk, _enc, cb) { size += chunk.length; if (size > limit) return cb(new Error(`${label} exceeds ${limit} bytes.`)); digest.update(chunk); cb(null, chunk); } });
  try { await pipeline(input, meter, createWriteStream(temp, { flags: "wx", mode: 0o600 })); const glb = await validateGlbFile(temp); renameSync(temp, destination); return { bytes: size, sha256: digest.digest("hex"), ...glb }; }
  catch (error) { rmSync(temp, { force: true }); throw error; }
}

export async function importGlb({ sourceFile, destination, maxBytes = MAX_BYTES }) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BYTES) throw new Error("Invalid GLB size limit.");
  const source = resolve(sourceFile ?? "");
  if (!sourceFile || !existsSync(source) || !statSync(source).isFile()) throw new Error(`Source GLB does not exist: ${sourceFile}`);
  if (statSync(source).size > maxBytes) throw new Error(`Source GLB exceeds ${maxBytes} bytes.`);
  mkdirSync(dirname(destination), { recursive: true });
  return streamToFile(createReadStream(source), destination, maxBytes, "Source GLB");
}

export async function downloadGlb({ modelUrl, destination, fetchImpl = fetch, maxBytes = MAX_BYTES, maxRedirects = MAX_REDIRECTS }) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BYTES) throw new Error("Invalid GLB size limit.");
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > MAX_REDIRECTS) throw new Error("Invalid redirect limit.");
  let current = assertModelUrl(modelUrl), response;
  for (let redirects = 0;; redirects++) {
    response = await fetchImpl(current, { redirect: "manual", headers: { "user-agent": "Ikea-model-collector/0.1" } });
    if (response.status < 300 || response.status >= 400) break;
    if (redirects >= maxRedirects) throw new Error(`Model download exceeded ${maxRedirects} redirects.`);
    const location = response.headers.get("location"); if (!location) throw new Error("Redirect is missing Location.");
    current = assertModelUrl(new URL(location, current).toString());
  }
  if (!response.ok) throw new Error(`Model download failed with HTTP ${response.status}.`);
  const length = Number(response.headers.get("content-length")); if (Number.isFinite(length) && length > maxBytes) throw new Error(`Model download exceeds ${maxBytes} bytes.`);
  if (!response.body) throw new Error("Model response has no body.");
  mkdirSync(dirname(destination), { recursive: true });
  return { ...(await streamToFile(response.body, destination, maxBytes, "Model download")), resolvedModelUrl: current.toString() };
}

function capture(value) {
  if (!value) return undefined;
  const data = typeof value === "string" ? JSON.parse(readFileSync(resolve(value), "utf8")) : value;
  if (data.schemaVersion !== CAPTURE_SCHEMA) throw new Error(`Capture metadata must use ${CAPTURE_SCHEMA}.`);
  if (data.productUrl) assertProductUrl(data.productUrl);
  return data;
}
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "asset"; }
function acquisitions(dir) { return existsSync(join(dir,"acquisitions.jsonl")) ? readFileSync(join(dir,"acquisitions.jsonl"),"utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : []; }
function recordAcquisition(dir, entry) {
  const acquisitionId=createHash("sha256").update([entry.productUrl,entry.articleNumber,entry.assetId].join("\n")).digest("hex").slice(0,16);
  const existing=acquisitions(dir).find(item=>item.acquisitionId===acquisitionId);
  if(existing)return existing;
  const recorded={schemaVersion:"ikea_model_acquisition.v1",acquisitionId,recordedAt:new Date().toISOString(),rightsUseReminder:"Local personal research and learning only; redistribution and commercial use are not permitted without authorization.",...entry};
  writeFileSync(join(dir,"acquisitions.jsonl"),`${JSON.stringify(recorded)}\n`,{flag:"a",mode:0o600});
  return recorded;
}

export async function addModel({ collectionId, productUrl, modelUrl, sourceFile, captureFile, name, articleNumber, variant, category, subcategory, tags = [], projectDir = process.cwd(), fetchImpl = fetch, maxBytes = MAX_BYTES }) {
  const { dir, path, collection } = requireCollection(collectionId, projectDir);
  const captured = capture(captureFile);
  const product = assertProductUrl(productUrl ?? captured?.productUrl).toString();
  const observedModel = assertModelUrl(modelUrl ?? captured?.modelUrl).toString();
  name = String(name ?? captured?.name ?? "").trim(); articleNumber = String(articleNumber ?? captured?.articleNumber ?? "").trim();
  if (!name || !articleNumber) throw new Error("name and article-number are required (directly or in capture metadata).");
  const incoming = join(dir, `incoming-${randomUUID()}.glb`);
  try {
    const result = sourceFile ? await importGlb({ sourceFile, destination: incoming, maxBytes }) : await downloadGlb({ modelUrl: observedModel, destination: incoming, fetchImpl, maxBytes });
    const duplicate = assets(dir).find(a => a.sha256 === result.sha256);
    if (duplicate) {
      rmSync(incoming, { force: true });
      const acquisition=recordAcquisition(dir,{status:"deduplicated",deduplicatedTo:duplicate.assetId,assetId:duplicate.assetId,name,articleNumber,...(variant??captured?.variant?{variant:variant??captured.variant}:{}),productUrl:product,modelUrl:observedModel,capturedAt:captured?.capturedAt??new Date().toISOString(),locale:captured?.locale??collection.locale,...(captured?.dimensions?{dimensions:captured.dimensions}:{})});
      json(path,{...collection,updatedAt:new Date().toISOString()});
      return { collectionId, assetId: duplicate.assetId, idempotent: true, acquisition, metadata: duplicate };
    }
    const assetId = `${slug(articleNumber)}-${result.sha256.slice(0, 12)}`, assetPath = `assets/${assetId}.glb`;
    renameSync(incoming, join(dir, assetPath));
    const metadata = {
      schemaVersion: "ikea_model_asset.v1", assetId, name, articleNumber, ...(variant ?? captured?.variant ? { variant: variant ?? captured.variant } : {}),
      productUrl: product, requestedModelUrl: observedModel, resolvedModelUrl: result.resolvedModelUrl ?? observedModel,
      captureMode: sourceFile ? "browser-response-body" : "https-fallback", capturedAt: captured?.capturedAt ?? new Date().toISOString(), locale: captured?.locale ?? collection.locale,
      ...(category ? { category } : {}), ...(subcategory ? { subcategory } : {}), ...(tags.length ? { tags } : {}),
      ...(captured?.dimensions ? { dimensions: captured.dimensions } : {}), assetPath, sha256: result.sha256, bytes: result.bytes, glbVersion: result.version,
      extensionsUsed: result.extensionsUsed, extensionsRequired: result.extensionsRequired, rightsUseReminder:"Local personal research and learning only; redistribution and commercial use are not permitted without authorization.", addedAt: new Date().toISOString()
    };
    json(join(dir, "metadata", `${assetId}.json`), metadata);
    const acquisition=recordAcquisition(dir,{status:"imported",assetId,name,articleNumber,...(metadata.variant?{variant:metadata.variant}:{}),productUrl:product,modelUrl:observedModel,capturedAt:metadata.capturedAt,locale:metadata.locale,...(metadata.dimensions?{dimensions:metadata.dimensions}:{})});
    json(path, { ...collection, updatedAt: new Date().toISOString() });
    return { collectionId, assetId, idempotent: false, acquisition, modelPath: join(dir, assetPath), metadata };
  } finally { rmSync(incoming, { force: true }); }
}

export function recordAttempt({ collectionId, result, productUrl, articleNumber, name, detail, projectDir = process.cwd() }) {
  const { dir } = requireCollection(collectionId, projectDir); if (!ATTEMPT_RESULTS.has(result)) throw new Error(`result must be one of: ${[...ATTEMPT_RESULTS].join(", ")}`);
  const entry = { result, recordedAt: new Date().toISOString(), ...(productUrl ? { productUrl: assertProductUrl(productUrl).toString() } : {}), ...(articleNumber ? { articleNumber } : {}), ...(name ? { name } : {}), ...(detail ? { detail } : {}) };
  const path = join(dir, "attempts.jsonl"); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(entry)}\n`, { flag: "a", mode: 0o600 }); return entry;
}

export function renderCollection({ collectionId, assetId, blender = "blender", projectDir = process.cwd() }) {
  const { dir } = requireCollection(collectionId, projectDir), selected = assets(dir).filter(a => !assetId || a.assetId === assetId);
  if (assetId && !selected.length) throw new Error(`Unknown asset: ${assetId}`);
  const renderer = join(dirname(new URL(import.meta.url).pathname), "render_glb_preview.py"), rendered = [];
  for (const asset of selected) {
    const output = join(dir, "previews", `${asset.assetId}.png`), metadata = join(dir, "previews", `${asset.assetId}.json`);
    const child = spawnSync(blender, ["--background", "--python", renderer, "--", "--model", join(dir, asset.assetPath), "--output", output, "--metadata", metadata], { encoding: "utf8" });
    if (child.status !== 0) throw new Error(`Blender failed for ${asset.assetId}: ${child.stderr || child.stdout}`);
    const preview = JSON.parse(readFileSync(metadata, "utf8")); const next = { ...asset, previewPath: `previews/${asset.assetId}.png`, geometry: { dimensionsMeters: preview.dimensionsMeters, source: "blender-bounds", measuredAt: new Date().toISOString() } };
    json(join(dir, "metadata", `${asset.assetId}.json`), next); rendered.push({ assetId: asset.assetId, output });
  }
  return { collectionId, preset: "orthographic-shadow-v5", rendered };
}

function csvCell(value) { const s = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function escapeHtml(value) { return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
function attempts(dir) { return existsSync(join(dir,"attempts.jsonl")) ? readFileSync(join(dir,"attempts.jsonl"),"utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : []; }

function gallery(collection, rows) {
  const cards = rows.map((a,i) => `<button class="card" data-i="${i}" data-search="${escapeHtml([a.name,a.articleNumber,a.category,a.subcategory,...(a.tags??[])].join(" ").toLowerCase())}">${a.previewPath ? `<img src="${escapeHtml(a.previewPath)}" alt="">` : '<span class="missing">3D</span>'}<strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.articleNumber)}</small></button>`).join("");
  const data = JSON.stringify(rows.map(a => ({ name:a.name, articleNumber:a.articleNumber, model:a.assetPath, metadata:`metadata/${a.assetId}.json` }))).replaceAll("<","\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(collection.name)}</title><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f2f3f4;color:#161616}header{padding:20px;background:#fff;position:sticky;top:0;z-index:2;border-bottom:1px solid #ddd}input{width:min(600px,100%);padding:10px;margin-top:10px}.layout{display:grid;grid-template-columns:360px 1fr;height:calc(100vh - 112px)}.grid{padding:16px;overflow:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{background:#fff;border:1px solid #ddd;padding:8px;text-align:left}.card img,.missing{display:grid;place-items:center;width:100%;aspect-ratio:1;object-fit:contain;background:#eee}.card strong,.card small{display:block;margin-top:6px}.viewer{position:relative}canvas{width:100%;height:100%;display:block}.note{position:absolute;left:16px;bottom:16px;background:#fffa;padding:8px}.note[data-error]{color:#a02020}@media(max-width:700px){.layout{grid-template-columns:1fr}.viewer{display:none}}</style><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script></head><body><header><b>${escapeHtml(collection.name)}</b><br><input id="q" placeholder="Search name, article, category"></header><main class="layout"><section class="grid">${cards}</section><section class="viewer" id="viewer"><div class="note">Three.js 0.180.0 · models stay on this local server</div></section></main><script>q.oninput=()=>document.querySelectorAll('.card').forEach(c=>c.hidden=!c.dataset.search.includes(q.value.toLowerCase()))</script><script type="module">import * as THREE from'three';import{OrbitControls}from'three/addons/controls/OrbitControls.js';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';import{DRACOLoader}from'three/addons/loaders/DRACOLoader.js';const A=${data},v=document.querySelector('#viewer'),note=v.querySelector('.note'),s=new THREE.Scene();s.background=new THREE.Color(0xe8e9ea);const c=new THREE.PerspectiveCamera(45,1,.01,1000),r=new THREE.WebGLRenderer({antialias:true});v.prepend(r.domElement);const o=new OrbitControls(c,r.domElement),draco=new DRACOLoader();draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');const loader=new GLTFLoader().setDRACOLoader(draco);s.add(new THREE.HemisphereLight(0xffffff,0x666666,2));let current;function size(){r.setSize(v.clientWidth,v.clientHeight);c.aspect=v.clientWidth/v.clientHeight;c.updateProjectionMatrix()}addEventListener('resize',size);size();function load(i){note.removeAttribute('data-error');note.textContent='Loading '+A[i].name;loader.load(A[i].model,g=>{if(current)s.remove(current);current=g.scene;s.add(current);const b=new THREE.Box3().setFromObject(current),z=b.getSize(new THREE.Vector3()),m=b.getCenter(new THREE.Vector3());current.position.sub(m);const d=Math.max(z.x,z.y,z.z);c.position.set(d*1.6,d*1.2,d*1.6);o.target.set(0,0,0);o.update();note.textContent=A[i].name+' · local model'},undefined,error=>{console.error(error);note.dataset.error='';note.textContent='Model load failed; inspect extension support'})}document.querySelectorAll('.card').forEach(x=>x.onclick=()=>load(+x.dataset.i));if(A.length)load(0);r.setAnimationLoop(()=>r.render(s,c));</script></body></html>`;
}

export function finalizeCollection({ collectionId, projectDir = process.cwd() }) {
  const { dir, collection } = requireCollection(collectionId, projectDir), rows = assets(dir), successful = acquisitions(dir), failed = attempts(dir);
  const categories = rows.reduce((index, asset) => {
    const category = asset.category ?? "uncategorized", subcategory = asset.subcategory ?? "uncategorized";
    index[category] ??= { count: 0, subcategories: {} };
    index[category].count += 1;
    index[category].subcategories[subcategory] = (index[category].subcategories[subcategory] ?? 0) + 1;
    return index;
  }, {});
  const catalog = { schemaVersion: "ikea_model_catalog.v1", generatedAt: new Date().toISOString(), collection, count: rows.length, categories, assets: rows };
  json(join(dir,"catalog.json"),catalog);
  atomic(join(dir,"catalog.csv"), ["asset_id,name,article_number,variant,category,subcategory,dimensions,asset_path,sha256",...rows.map(a=>[a.assetId,a.name,a.articleNumber,a.variant,a.category,a.subcategory,a.dimensions,a.assetPath,a.sha256].map(csvCell).join(","))].join("\n")+"\n");
  json(join(dir,"acquisition_report.json"),{ schemaVersion:"ikea_acquisition_report.v1", generatedAt:new Date().toISOString(), requested:successful.length+failed.length, succeeded:successful.length, uniqueAssets:rows.length, deduplicated:successful.filter(item=>item.status==="deduplicated").length, failedCount:failed.length, acquisitions:successful, failed });
  atomic(join(dir,"license_manifest.csv"),["asset_id,rights_holder,repository_license,permitted_use,redistribution",...rows.map(a=>[a.assetId,"IKEA / applicable rights holders","EXCLUDED","personal research and learning only","not permitted"].map(csvCell).join(","))].join("\n")+"\n");
  atomic(join(dir,"checksums.sha256"),rows.map(a=>`${a.sha256}  ${a.assetPath}`).join("\n")+(rows.length?"\n":""));
  atomic(join(dir,"gallery.html"),gallery(collection,rows));
  atomic(join(dir,"handoff.md"),`# ${collection.name} handoff\n\n- Requested candidates: ${successful.length+failed.length}\n- Successful acquisitions: ${successful.length}\n- Unique local assets: ${rows.length}\n- Deduplicated candidates: ${successful.filter(item=>item.status==="deduplicated").length}\n- Failed attempts: ${failed.length}\n- Terms acknowledged: ${collection.termsAcknowledgment.acknowledgedAt}\n- Preview: \`gallery.html\` via \`serve\`\n\nThis is a local collection for personal research and learning only. Models are excluded from the repository license. Do not redistribute or use commercially without authorization.\n`);
  return validateCollection({ collectionId, projectDir, writeReport:true });
}

export function validateCollection({ collectionId, projectDir = process.cwd(), writeReport = true }) {
  const { dir, collection } = requireCollection(collectionId, projectDir), rows = assets(dir), errors=[];
  if (collection.schemaVersion !== COLLECTION_SCHEMA) errors.push("invalid collection schema");
  if (!collection.termsAcknowledgment?.acknowledged) errors.push("missing terms acknowledgment");
  for (const asset of rows) {
    try { const path=contained(dir,join(dir,asset.assetPath),"asset path"); const info=validateGlb(readFileSync(path)); if(sha(path)!==asset.sha256) errors.push(`${asset.assetId}: checksum mismatch`); if(info.version!==2) errors.push(`${asset.assetId}: invalid GLB`); if(asset.previewPath&&!existsSync(contained(dir,join(dir,asset.previewPath),"preview path"))) errors.push(`${asset.assetId}: missing preview`); }
    catch(error){ errors.push(`${asset.assetId}: ${error.message}`); }
  }
  for(const required of ["catalog.json","catalog.csv","acquisition_report.json","license_manifest.csv","checksums.sha256","gallery.html","handoff.md"]) if(!existsSync(join(dir,required))) errors.push(`missing ${required}`);
  if(existsSync(join(dir,"catalog.json"))){try{const catalog=JSON.parse(readFileSync(join(dir,"catalog.json"),"utf8"));if(catalog.count!==rows.length)errors.push("catalog count mismatch");const indexed=new Set(catalog.assets?.map(asset=>asset.assetId));for(const asset of rows)if(!indexed.has(asset.assetId))errors.push(`${asset.assetId}: missing from catalog`);}catch(error){errors.push(`invalid catalog: ${error.message}`);}}
  if(existsSync(join(dir,"acquisition_report.json"))){try{const report=JSON.parse(readFileSync(join(dir,"acquisition_report.json"),"utf8")),successful=acquisitions(dir),failed=attempts(dir),assetIds=new Set(rows.map(asset=>asset.assetId));if(report.requested!==successful.length+failed.length||report.succeeded!==successful.length||report.uniqueAssets!==rows.length||report.deduplicated!==successful.filter(item=>item.status==="deduplicated").length||report.failedCount!==failed.length)errors.push("acquisition report count mismatch");for(const item of successful)if(!assetIds.has(item.assetId))errors.push(`${item.acquisitionId}: acquisition references missing asset`);}catch(error){errors.push(`invalid acquisition report: ${error.message}`);}}
  const report={ schemaVersion:"ikea_collection_validation.v1", validatedAt:new Date().toISOString(), collectionId, assets:rows.length, status:errors.length?"failed":"passed", errors };
  if(writeReport) json(join(dir,"validation_report.json"),report); return report;
}

export function showCollection({ collectionId, projectDir = process.cwd() }) { const {dir,collection}=requireCollection(collectionId,projectDir); return {...collection,collectionDir:dir,count:assets(dir).length,assets:assets(dir),acquisitions:acquisitions(dir),attempts:attempts(dir)}; }

const MIME={".html":"text/html; charset=utf-8",".json":"application/json; charset=utf-8",".csv":"text/csv; charset=utf-8",".md":"text/markdown; charset=utf-8",".png":"image/png",".glb":"model/gltf-binary"};
export function serveCollection({ collectionId, projectDir=process.cwd(), host="127.0.0.1", port=8765 }) {
  const {dir}=requireCollection(collectionId,projectDir); const server=createServer((req,res)=>{try{const url=new URL(req.url,"http://localhost"),rel=decodeURIComponent(url.pathname)==="/"?"gallery.html":decodeURIComponent(url.pathname).slice(1),path=contained(dir,join(dir,rel),"request path");if(!existsSync(path)||!statSync(path).isFile()){res.writeHead(404);res.end("Not found");return;}res.setHeader("Content-Type",MIME[extname(path)]??"application/octet-stream");res.setHeader("X-Content-Type-Options","nosniff");createReadStream(path).pipe(res);}catch{res.writeHead(400);res.end("Bad request");}}); server.listen(port,host); return server;
}
