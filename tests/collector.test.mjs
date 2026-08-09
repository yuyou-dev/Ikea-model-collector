import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import {
  CAPTURE_SCHEMA, MAX_BYTES, addModel, assertModelUrl, assertProductUrl, contained, downloadGlb,
  finalizeCollection, initCollection, recordAttempt, renderCollection, serveCollection, showCollection,
  validateCollection, validateGlb
} from "../.agents/skills/ikea-model-collector/scripts/lib.mjs";

function workspace() { return mkdtempSync(join(tmpdir(), "ikea-collector-test-")); }
function glb(extra = {}) {
  let chunk = Buffer.from(JSON.stringify({ asset:{version:"2.0"},...extra }));
  chunk = Buffer.concat([chunk, Buffer.alloc((4 - chunk.length % 4) % 4, 0x20)]);
  const out = Buffer.alloc(20 + chunk.length);
  out.write("glTF",0); out.writeUInt32LE(2,4); out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(chunk.length,12); out.writeUInt32LE(0x4e4f534a,16); chunk.copy(out,20);
  return out;
}
const productUrl="https://www.ikea.com/us/en/p/test-product-12345678/";
const modelUrl="https://web-api.ikea.com/dimma/assets/1.2/12345678/PS01/glb_draco/hash-12345678.glb?cn=pip";

test("URL policy accepts IKEA HTTPS and observed DIMMA only",()=>{
  assert.equal(assertProductUrl(productUrl).hostname,"www.ikea.com");
  assert.equal(assertModelUrl(modelUrl).hostname,"web-api.ikea.com");
  for(const bad of ["http://www.ikea.com/p/a","https://user:pass@www.ikea.com/p/a","https://localhost/a","https://127.0.0.1/a","https://example.com/p/a"]) assert.throws(()=>assertProductUrl(bad));
  for(const bad of ["https://web-api.ikea.com/other/model.glb","https://example.com/dimma/assets/model.glb","https://web-api.ikea.com/dimma/assets/model.obj"]) assert.throws(()=>assertModelUrl(bad));
  assert.throws(()=>contained("/tmp/allowed","/tmp/nope","test"),/escapes/);
});

test("GLB v2 validation checks magic, version, length, and extensions",()=>{
  const bytes=glb({extensionsUsed:["KHR_draco_mesh_compression"]});
  assert.deepEqual(validateGlb(bytes).extensionsUsed,["KHR_draco_mesh_compression"]);
  assert.throws(()=>validateGlb(Buffer.from("html")),/magic/);
  const old=Buffer.from(bytes);old.writeUInt32LE(1,4);assert.throws(()=>validateGlb(old),/version/);
  const wrong=Buffer.from(bytes);wrong.writeUInt32LE(99,8);assert.throws(()=>validateGlb(wrong),/declared length/);
});

test("init requires explicit terms acknowledgment",()=>{
  const projectDir=workspace();
  assert.throws(()=>initCollection({collectionId:"demo",locale:"en-US",projectDir}),/acknowledge/);
  const created=initCollection({collectionId:"demo",name:"Demo",locale:"en-US",acknowledgeTerms:true,projectDir});
  assert.equal(created.termsAcknowledgment.acknowledged,true);
  assert.equal(created.count,0);
});

test("source-file import is preferred, captures dimensions, and deduplicates by SHA",async()=>{
  const projectDir=workspace(), source=join(projectDir,"captured.glb"), capture=join(projectDir,"capture.json");
  writeFileSync(source,glb({extensionsRequired:["EXT_texture_webp"]}));
  writeFileSync(capture,JSON.stringify({schemaVersion:CAPTURE_SCHEMA,name:"TESTA",articleNumber:"123.456.78",variant:"oak",locale:"en-US",productUrl,modelUrl,capturedAt:"2026-08-10T00:00:00.000Z",dimensions:{raw:{width:"80 cm"},meters:{x:0.8,y:0.4,z:0.5},source:"product-page"}}));
  initCollection({collectionId:"source-test",locale:"en-US",acknowledgeTerms:true,projectDir});
  const first=await addModel({collectionId:"source-test",sourceFile:source,captureFile:capture,projectDir});
  assert.equal(first.idempotent,false); assert.equal(first.metadata.captureMode,"browser-response-body"); assert.equal(first.metadata.dimensions.meters.x,0.8);
  assert.ok(existsSync(join(projectDir,".ikea-model-collector/collections/source-test",first.metadata.assetPath)));
  const second=await addModel({collectionId:"source-test",sourceFile:source,captureFile:capture,projectDir});
  assert.equal(second.idempotent,true); assert.equal(showCollection({collectionId:"source-test",projectDir}).count,1); assert.equal(showCollection({collectionId:"source-test",projectDir}).acquisitions.length,1);
});

test("download follows validated redirects and rejects overflow, HTML, and excess redirects",async()=>{
  const projectDir=workspace(), destination=join(projectDir,"download.glb"), bytes=glb(); let calls=0;
  const fetchImpl=async()=>{calls++;return calls===1?new Response(null,{status:302,headers:{location:"/dimma/assets/1.2/123/PS/glb_draco/final.glb"}}):new Response(bytes,{status:200,headers:{"content-length":String(bytes.length)}})};
  const result=await downloadGlb({modelUrl,destination,fetchImpl}); assert.equal(result.resolvedModelUrl,"https://web-api.ikea.com/dimma/assets/1.2/123/PS/glb_draco/final.glb"); assert.equal(calls,2);
  await assert.rejects(downloadGlb({modelUrl,destination:join(projectDir,"large.glb"),maxBytes:12,fetchImpl:async()=>new Response(bytes,{status:200})}),/exceeds/);
  await assert.rejects(downloadGlb({modelUrl,destination:join(projectDir,"html.glb"),fetchImpl:async()=>new Response("<!doctype html>",{status:200})}),/magic/);
  await assert.rejects(downloadGlb({modelUrl,destination:join(projectDir,"redirect.glb"),fetchImpl:async()=>new Response(null,{status:302,headers:{location:modelUrl}})}),/exceeded 3 redirects/);
  await assert.rejects(downloadGlb({modelUrl,destination,maxBytes:MAX_BYTES+1}),/size limit/);
});

test("record, render, finalize, validate, serve form an end-to-end handoff",async(t)=>{
  const projectDir=workspace(), source=join(projectDir,"item.glb"), fake=join(projectDir,"fake-blender.mjs"); writeFileSync(source,glb());
  writeFileSync(fake,`#!/usr/bin/env node\nimport{writeFileSync}from'node:fs';const a=process.argv,o=a[a.indexOf('--output')+1],m=a[a.indexOf('--metadata')+1];writeFileSync(o,Buffer.from('89504e470d0a1a0a','hex'));writeFileSync(m,JSON.stringify({dimensionsMeters:{x:1,y:2,z:3},studio:{preset:'orthographic-shadow-v5'}}));\n`);chmodSync(fake,0o755);
  initCollection({collectionId:"e2e",name:"E2E",locale:"en-US",acknowledgeTerms:true,projectDir});
  const added=await addModel({collectionId:"e2e",sourceFile:source,productUrl,modelUrl,name:"Chair",articleNumber:"12345678",category:"seating",projectDir});
  recordAttempt({collectionId:"e2e",result:"model_unavailable",productUrl,name:"No model",projectDir});
  const rendered=renderCollection({collectionId:"e2e",assetId:added.assetId,blender:fake,projectDir}); assert.equal(rendered.rendered.length,1);
  const finalized=finalizeCollection({collectionId:"e2e",projectDir}); assert.equal(finalized.status,"passed");
  const dir=showCollection({collectionId:"e2e",projectDir}).collectionDir;
  for(const name of ["catalog.json","catalog.csv","acquisition_report.json","license_manifest.csv","checksums.sha256","gallery.html","handoff.md","validation_report.json"]) assert.ok(existsSync(join(dir,name)),name);
  const gallery=readFileSync(join(dir,"gallery.html"),"utf8");
  assert.match(gallery,/three@0\.180\.0/); assert.match(gallery,/type="importmap"/); assert.match(gallery,/DRACOLoader/); assert.match(gallery,/setDecoderPath/);
  assert.match(readFileSync(join(dir,"license_manifest.csv"),"utf8"),/not permitted/);
  assert.match(readFileSync(join(dir,"handoff.md"),"utf8"),/local collection for personal research and learning only/);
  assert.equal(JSON.parse(readFileSync(join(dir,"catalog.json"),"utf8")).categories.seating.count,1);
  const acquisitionReport=JSON.parse(readFileSync(join(dir,"acquisition_report.json"),"utf8"));assert.deepEqual({requested:acquisitionReport.requested,succeeded:acquisitionReport.succeeded,uniqueAssets:acquisitionReport.uniqueAssets,deduplicated:acquisitionReport.deduplicated,failedCount:acquisitionReport.failedCount},{requested:2,succeeded:1,uniqueAssets:1,deduplicated:0,failedCount:1});
  assert.equal(validateCollection({collectionId:"e2e",projectDir}).status,"passed");
  const server=serveCollection({collectionId:"e2e",projectDir,port:0}); await once(server,"listening"); t.after(()=>server.close());
  const address=server.address(), page=await fetch(`http://127.0.0.1:${address.port}/gallery.html`); assert.equal(page.status,200); assert.match(await page.text(),/Chair/);
  const traversal=await fetch(`http://127.0.0.1:${address.port}/%2e%2e/package.json`); assert.notEqual(traversal.status,200);
});

test("distinct candidates sharing one GLB retain provenance while deduplicating the asset",async()=>{
  const projectDir=workspace(),source=join(projectDir,"shared.glb");writeFileSync(source,glb());
  initCollection({collectionId:"dedupe",locale:"en-US",acknowledgeTerms:true,projectDir});
  const first=await addModel({collectionId:"dedupe",sourceFile:source,productUrl,modelUrl,name:"First",articleNumber:"111.111.11",projectDir});
  const second=await addModel({collectionId:"dedupe",sourceFile:source,productUrl:"https://www.ikea.com/us/en/p/second-87654321/",modelUrl,name:"Second",articleNumber:"222.222.22",projectDir});
  assert.equal(first.idempotent,false);assert.equal(second.idempotent,true);
  finalizeCollection({collectionId:"dedupe",projectDir});
  const state=showCollection({collectionId:"dedupe",projectDir}),report=JSON.parse(readFileSync(join(state.collectionDir,"acquisition_report.json"),"utf8"));
  assert.equal(state.count,1);assert.equal(state.acquisitions.length,2);assert.equal(report.requested,2);assert.equal(report.succeeded,2);assert.equal(report.uniqueAssets,1);assert.equal(report.deduplicated,1);assert.equal(report.failedCount,0);assert.equal(validateCollection({collectionId:"dedupe",projectDir}).status,"passed");
});

test("attempt result contract rejects arbitrary statuses",()=>{
  const projectDir=workspace();initCollection({collectionId:"attempt",locale:"en-US",acknowledgeTerms:true,projectDir});
  assert.throws(()=>recordAttempt({collectionId:"attempt",result:"downloaded",projectDir}),/result must be/);
});

test("CLI rejects an arbitrary project output directory",()=>{
  const cli=join(import.meta.dirname,"../.agents/skills/ikea-model-collector/scripts/ikea-model-collector.mjs");
  const child=spawnSync(process.execPath,[cli,"show","--collection-id","demo","--project-dir",workspace()],{encoding:"utf8"});
  assert.notEqual(child.status,0);assert.match(child.stderr,/not supported.+confined to the current project/);
});
