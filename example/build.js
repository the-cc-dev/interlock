var path = require("path");

var Interlock = require("..");

var ilk = new Interlock({
  srcRoot: __dirname,
  destRoot: path.join(__dirname, "dist"),

  entry: {
    "./app/entry-a.js": "entry-a.bundle.js",
    "./app/entry-b.js": { dest: "entry-b.bundle.js" }
  },
  split: {
    "./app/shared/lib-a.js": "[setHash].js"
  },

  includeComments: true,
  sourceMaps: true,
  // cacheMode: "localStorage",

  implicitBundleDest: "[setHash].js",

  plugins: []
});


ilk.watch(true).observe(function (buildEvent) {
  var patchModules = buildEvent.patchModules;
  var compilation = buildEvent.compilation;

  if (patchModules) {
    const paths = patchModules.map(function (module) { return module.path; });
    console.log("the following modules have been updated:", paths);
  }
  if (compilation) {
    console.log("a new compilation has completed");
  }
});

// ilk.build();
