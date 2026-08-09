#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root=resolve(new URL("../../../../",import.meta.url).pathname);
const forbidden=/\.(glb|gltf|blend|blend1|fbx|obj|stl|dae|3ds|abc|ply|usdz?|zip|7z|rar|tar|tgz)$/i;
const sensitiveNames=new Set([".env","credentials.json","service-account.json","id_rsa","id_ed25519"]);
const credentialPatterns=[
  /BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY/,
  /gh[oprsu]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
];
const localPathPatterns=[
  /file:\/\/\/(?:Users|home)\//,
  /\/var\/folders\//,
  /\/Users\/(?!example(?:\/|$)|username(?:\/|$)|your-name(?:\/|$))[^/\s"']+\//,
  /\/home\/(?!runner(?:\/|$)|example(?:\/|$)|user(?:\/|$))[^/\s"']+\//,
  /[A-Za-z]:\\Users\\[^\\\s"']+\\/,
];
const errors=[];
function walk(dir){for(const name of readdirSync(dir)){if([".git","node_modules",".ikea-model-collector"].includes(name))continue;const path=join(dir,name),st=statSync(path),rel=relative(root,path);if(st.isDirectory())walk(path);else{if(forbidden.test(name))errors.push(`${rel}: forbidden asset or archive type`);if(sensitiveNames.has(name))errors.push(`${rel}: sensitive filename`);if(st.size>5*1024*1024)errors.push(`${rel}: exceeds 5 MiB repository limit`);if(st.size<5*1024*1024){const content=readFileSync(path,"utf8");if(credentialPatterns.some(pattern=>pattern.test(content)))errors.push(`${rel}: possible credential`);if(rel!==relative(root,import.meta.filename)&&localPathPatterns.some(pattern=>pattern.test(content)))errors.push(`${rel}: possible machine-local path`);if(name.endsWith(".md")){for(const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){const target=match[1].trim().replace(/^<|>$/g,"").split("#",1)[0];if(!target||/^(?:https?:|mailto:)/i.test(target))continue;const local=resolve(dirname(path),decodeURIComponent(target));if(!existsSync(local))errors.push(`${rel}: broken local Markdown link ${match[1]}`);}}}}}}
if(!existsSync(root))throw new Error("Repository root not found");walk(root);if(errors.length){process.stderr.write(`${errors.join("\n")}\n`);process.exitCode=1;}else process.stdout.write("Repository audit passed: no forbidden assets, oversized files, credentials, machine-local paths, or broken local Markdown links.\n");
