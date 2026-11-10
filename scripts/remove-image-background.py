"""Portable, local CPU cutouts. No remote inference or paid model backends."""
import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--batch", type=Path)
    parser.add_argument("--model", choices=["isnet-general-use", "u2net"], default="isnet-general-use")
    parser.add_argument("--warmup", action="store_true")
    args = parser.parse_args()
    os.environ.setdefault("OMP_NUM_THREADS", "2")
    os.environ.setdefault("REMBG_HOME", str(Path(__file__).resolve().parents[1] / ".cache" / "rembg"))
    from rembg import new_session, remove
    from PIL import Image

    session = new_session(args.model, providers=["CPUExecutionProvider"])
    if args.warmup:
        print(json.dumps({"model": args.model, "provider": "CPUExecutionProvider", "ready": True}))
        return
    if args.batch:
        pairs = json.loads(args.batch.read_text())
    elif args.input and args.output:
        pairs = [{"input": args.input, "output": args.output}]
    else:
        parser.error("Provide input/output or --batch, or use --warmup")
    for pair in pairs:
        source, target = Path(pair["input"]), Path(pair["output"])
        target.parent.mkdir(parents=True, exist_ok=True)
        result = remove(source.read_bytes(), session=session)
        temp = target.with_suffix(".tmp.png")
        temp.write_bytes(result)
        with Image.open(temp) as image:
            alpha = image.convert("RGBA").getchannel("A")
            low, high = alpha.getextrema()
            if low >= 8 or high <= 16:
                temp.unlink(missing_ok=True)
                raise RuntimeError(f"No usable transparent foreground: {source.name}")
        temp.replace(target)
        print(json.dumps({"output": str(target), "model": args.model}))


if __name__ == "__main__":
    main()
