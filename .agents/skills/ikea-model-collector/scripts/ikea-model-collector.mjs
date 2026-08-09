#!/usr/bin/env node
import { addModel, finalizeCollection, initCollection, recordAttempt, renderCollection, serveCollection, showCollection, validateCollection } from "./lib.mjs";

export function parseArgs(argv) {
  const [command,...rest]=argv, args={_:[]};
  for(let i=0;i<rest.length;i++){const token=rest[i];if(!token.startsWith("--")){args._.push(token);continue;}const key=token.slice(2);if(rest[i+1]&&!rest[i+1].startsWith("--"))args[key]=rest[++i];else args[key]=true;}
  return {command,args};
}
function id(a){return a["collection-id"]??a._[0];}
function common(a){return {collectionId:id(a)};}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}

export async function main(argv=process.argv.slice(2)) {
  const {command,args}=parseArgs(argv); let value;
  if("project-dir" in args)throw new Error("--project-dir is not supported; collection output is confined to the current project.");
  switch(command){
    case "init": value=initCollection({...common(args),name:args.name,locale:args.locale,termsUrl:args["terms-url"],acknowledgeTerms:args["acknowledge-terms"]===true});break;
    case "add": value=await addModel({...common(args),productUrl:args["product-url"],modelUrl:args["model-url"],sourceFile:args["source-file"],captureFile:args["capture-file"],name:args.name,articleNumber:args["article-number"],variant:args.variant,category:args.category,subcategory:args.subcategory,tags:args.tags?String(args.tags).split(",").filter(Boolean):[]});break;
    case "record-attempt": value=recordAttempt({...common(args),result:args.result,productUrl:args["product-url"],articleNumber:args["article-number"],name:args.name,detail:args.detail});break;
    case "render": value=renderCollection({...common(args),assetId:args["asset-id"],blender:args.blender});break;
    case "finalize": value=finalizeCollection(common(args));break;
    case "validate": value=validateCollection(common(args));if(value.status!=="passed")process.exitCode=1;break;
    case "show": value=showCollection(common(args));break;
    case "serve": {const server=serveCollection({...common(args),host:args.host??"127.0.0.1",port:Number(args.port??8765)});print({url:`http://${args.host??"127.0.0.1"}:${args.port??8765}/gallery.html`,pid:process.pid});await new Promise((resolve,reject)=>{server.on("close",resolve);server.on("error",reject)});return;}
    default: throw new Error("Usage: ikea-model-collector <init|add|record-attempt|render|finalize|validate|show|serve> [options]");
  }
  print(value);
}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(error=>{process.stderr.write(`Error: ${error.message}\n`);process.exitCode=1;});
