"""Install two pinned npm packages without running package lifecycle scripts."""
import base64
import hashlib
import io
import json
import os
import pathlib
import shutil
import tarfile
import urllib.request

VERSION = "1.3.4"
ROOT = pathlib.Path(os.environ["LOCALAPPDATA"]) / "GravityWeComReport" / "wecom-cli"

def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "wecom-cli-setup"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()

installed = []
for name in ("cli", "cli-win32-x64"):
    metadata = json.loads(fetch(f"https://registry.npmjs.org/@wecom%2f{name}/{VERSION}"))
    if metadata["name"] != f"@wecom/{name}" or metadata["version"] != VERSION:
        raise RuntimeError("Unexpected registry package identity")
    integrity = metadata["dist"]["integrity"]
    if not integrity.startswith("sha512-"):
        raise RuntimeError("Expected SHA-512 package integrity")
    archive = fetch(metadata["dist"]["tarball"])
    if base64.b64encode(hashlib.sha512(archive).digest()).decode() != integrity[7:]:
        raise RuntimeError("Package integrity check failed")
    destination = ROOT / "node_modules" / "@wecom" / name
    destination.mkdir(parents=True, exist_ok=True)
    resolved_root = destination.resolve()
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
        for member in bundle.getmembers():
            parts = pathlib.PurePosixPath(member.name).parts
            if not parts or parts[0] != "package":
                raise RuntimeError("Unexpected package archive prefix")
            target = destination.joinpath(*parts[1:]).resolve()
            if not target.is_relative_to(resolved_root):
                raise RuntimeError("Package archive escapes install directory")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
            else:
                raise RuntimeError("Links and special files are not allowed")
    installed.append({"package": metadata["name"], "version": VERSION,
                      "integrity": integrity, "download_bytes": len(archive)})
ROOT.mkdir(parents=True, exist_ok=True)
(ROOT / "installed.json").write_text(json.dumps(installed, indent=2), encoding="utf-8")
print(json.dumps({"root": str(ROOT), "packages": installed}))
