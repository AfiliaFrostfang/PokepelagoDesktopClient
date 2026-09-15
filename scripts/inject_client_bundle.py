"""Inject the compiled web client into an APWorld archive."""

from __future__ import annotations

import sys
import tempfile
import zipfile
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: inject_client_bundle.py APWORLD DIST_DIR")

    archive = Path(sys.argv[1])
    dist = Path(sys.argv[2])
    index = dist / "index.html"
    if not archive.is_file():
        raise FileNotFoundError(f"APWorld archive not found: {archive}")
    if not index.is_file():
        raise FileNotFoundError(f"Built client entrypoint not found: {index}")

    prefix = "pokepelago/client_dist/"
    with tempfile.NamedTemporaryFile(suffix=".apworld", delete=False) as temporary:
        temporary_archive = Path(temporary.name)

    try:
        with zipfile.ZipFile(archive, "r") as original, zipfile.ZipFile(
            temporary_archive, "w", compression=zipfile.ZIP_DEFLATED
        ) as output:
            for entry in original.infolist():
                if not entry.filename.startswith(prefix):
                    output.writestr(entry, original.read(entry.filename))
            for source in dist.rglob("*"):
                if source.is_file():
                    relative = source.relative_to(dist).as_posix()
                    output.write(source, prefix + relative)
        temporary_archive.replace(archive)
    finally:
        temporary_archive.unlink(missing_ok=True)


if __name__ == "__main__":
    main()