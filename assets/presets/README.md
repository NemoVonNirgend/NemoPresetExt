# Bundled Nemo Engine v12.1 releases

These assets contain the four supplied portable v12.1 releases, compressed with gzip. The installer decompresses only the selected edition and verifies its exact source byte count and SHA-256 before parsing it. Names retain the original `braile space` spelling for compatibility with existing presets.

| Asset | Source filename | Source SHA-256 |
| --- | --- | --- |
| `standard-v12.1.json.gz` | `Nemo Engine v12.1.json` | `42027f4ad25f13ffd3d8ce881d4a2b2007c5dcaac2bbf350ed56c45faf443d0f` |
| `standard-braille-v12.1.json.gz` | `Nemo Engine v12.1 [braile space].json` | `1715aa7e7c0443f84306758ed72ce28d4975a50f01a94eb8c19d09bc30d68d46` |
| `full-v12.1.json.gz` | `Nemo Engine v12.1 full.json` | `6c8b0add6faff04556ffc2b200fd37f51a0ff98654df4efce397ce80d462076e` |
| `full-braille-v12.1.json.gz` | `Nemo Engine v12.1 full [braile space].json` | `b01378f4fb25729020622a9a88cc45b02b97f3649f1ce61ca3b7338e05802a66` |

Release metadata is in `features/preset-installer/catalog.js`. To replace a bundled release, retain the exact portable UTF-8 bytes, compress with Python `gzip.compress(source_bytes, compresslevel=9, mtime=0)`, and update the catalog's version, names, paths, source/compressed byte counts, checksums, and prompt/regex counts. Update these source records and run `node --test tests/preset-installer.test.js` before publishing. All four bundled editions are tested through the actual recipe, Vex, and prompt-body import/export controllers, including exact portable content restoration.
