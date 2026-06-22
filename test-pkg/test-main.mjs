import { writeFileSync } from 'fs';
const electronGlobals = Object.keys(globalThis).filter(k =>
  !['globalThis','global','process','console','setTimeout','clearTimeout','setInterval','clearInterval',
    'setImmediate','clearImmediate','URL','URLSearchParams','TextEncoder','TextDecoder',
    'performance','crypto','Event','EventTarget','AbortController','AbortSignal',
    'Buffer','queueMicrotask','structuredClone','atob','btoa','fetch','Headers','Request','Response',
    'ReadableStream','WritableStream','TransformStream','FormData','Blob','File',
    'MessageChannel','MessageEvent','MessagePort','navigator','window'].includes(k)
).slice(0, 30);
writeFileSync('C:/Users/User/Documents/GitHub/fuzi/test-out2.txt',
  `type: ${process.type}\nglobals: ${electronGlobals.join(',')}\n`);
process.exit(0);
