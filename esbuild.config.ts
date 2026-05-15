import esbuild from "esbuild";

// Node.js built-in modules to exclude from the bundle
const NODE_BUILTINS = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "https",
  "module",
  "net",
  "os",
  "path",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "zlib",
];

const prod = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

void (async () => {
  const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
      "obsidian",
      "electron",
      "@codemirror/state",
      "@codemirror/view",
      ...NODE_BUILTINS,
    ],
    format: "cjs",
    target: "es2020",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
  });
  if (watch) {
    await context.watch();
    console.log("Watching for changes…");
  } else {
    await context.rebuild();
    await context.dispose();
  }
})();
