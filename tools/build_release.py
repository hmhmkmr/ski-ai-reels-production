"""Build a deterministic cumulative update for the existing Windows x64 distribution."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def json_bytes(obj):
    return (json.dumps(obj, indent=2, ensure_ascii=False) + '\n').encode('utf-8')


def build(version, out):
    if not re.fullmatch(r'v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)', version):
        raise ValueError('Expected a release tag such as v1.1.0')
    base = json.loads((ROOT/'distribution/base.json').read_bytes())
    manifest = dict(base, release=version[1:]+'-windows-x64-existing-codex', sha256=dict(base['sha256']))
    entries = {}
    for file in sorted((ROOT/'skill').rglob('*')):
        if not file.is_file():
            continue
        if file.is_symlink():
            raise ValueError('Do not package symbolic links')
        key = file.relative_to(ROOT/'skill').as_posix()
        if key == 'release.json' or any(part.startswith('.') for part in Path(key).parts):
            raise ValueError('Unexpected managed path: '+key)
        raw = file.read_bytes()
        entries['payload/'+key] = raw
        manifest['sha256'][key] = hashlib.sha256(raw).hexdigest()
    for key in json.loads((ROOT/'distribution/removed.json').read_bytes()):
        if key not in manifest['sha256'] or 'payload/'+key in entries:
            raise ValueError('Invalid removed path: '+key)
        del manifest['sha256'][key]
    entries['base.json'] = json_bytes(base)
    entries['next.json'] = json_bytes(manifest)
    for name in ('apply.cjs','update.cmd'):
        entries[name] = (ROOT/'update'/name).read_bytes()
    out.mkdir(exist_ok=True, parents=True)
    target = out/'ski-ai-reels-update.zip'
    with zipfile.ZipFile(target,'w') as archive:
        for name, raw in sorted(entries.items()):
            entry = zipfile.ZipInfo(name,(2026,1,1,0,0,0))
            entry.compress_type=zipfile.ZIP_DEFLATED
            entry.external_attr=0o100644<<16
            archive.writestr(entry,raw)
    hashed=hashlib.sha256(target.read_bytes()).hexdigest()
    (out/(target.name+'.sha256')).write_bytes((hashed+'  '+target.name+'\n').encode('ascii'))
    print(version, target.name, target.stat().st_size, hashed)


if __name__=='__main__':
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('tag')
    cli.add_argument('--out',type=Path,required=True)
    args=cli.parse_args()
    build(args.tag,args.out)

