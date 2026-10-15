"""Variante paramétrica da skill rack-3d-ctech: duas caixas sem padrão de U.
Gera HTML autônomo, preservando o Three.js r128 e a logo fornecidos pela skill.
Uso: python build.py [config.json] --output index.html
"""
import argparse
import base64
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def build(config_path, output_path):
    config = json.loads(Path(config_path).read_text(encoding="utf-8-sig"))
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js é necessário para validar a geometria antes de gerar o HTML.")
    check = subprocess.run([node, "-e", "const fs=require('fs');const m=require('./src/layout.js'),k=require('./src/cables.js');const c=JSON.parse(fs.readFileSync(0,'utf8'));const r=m.calculate(c);console.log(JSON.stringify(r.errors.length?r.errors:k.validate(c,r)));",],
                           input=json.dumps(config), capture_output=True, text=True, encoding="utf-8", cwd=ROOT, check=True)
    errors = json.loads(check.stdout)
    if errors:
        raise ValueError("Configuração incompatível:\n" + "\n".join(errors))
    page = (ROOT / "src/template.html").read_text(encoding="utf-8")
    tokens = {
        "{{LOGO}}": base64.b64encode((ROOT / "assets/logo-ctech-claro.png").read_bytes()).decode(),
        "/*__STYLE__*/": (ROOT / "src/style.css").read_text(encoding="utf-8"),
        "/*__THREE__*/": (ROOT / "assets/three.r128.min.js").read_text(encoding="utf-8"),
        "/*__CONFIG__*/null": json.dumps(config, ensure_ascii=False).replace("</", "<\\/"),
        "/*__LAYOUT__*/": (ROOT / "src/layout.js").read_text(encoding="utf-8"),
        "/*__CABLES__*/": (ROOT / "src/cables.js").read_text(encoding="utf-8"),
        "/*__VIEWER__*/": (ROOT / "src/viewer.js").read_text(encoding="utf-8"),
        "/*__EDITOR__*/": (ROOT / "src/editor.js").read_text(encoding="utf-8"),
    }
    for token, value in tokens.items():
        page = page.replace(token, value)
    Path(output_path).write_text(page, encoding="utf-8")
    print(f"Gerado: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("config", nargs="?", default=str(ROOT / "config.json"))
    parser.add_argument("--output", default=str(ROOT / "index.html"))
    args = parser.parse_args()
    build(args.config, args.output)
