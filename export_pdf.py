"""Memorial visual do protótipo. Reutiliza as capturas verificadas do Three.js.
Fluxo derivado do export_pdf.py da skill rack-3d-ctech: captura real + ReportLab.
Execute build.py e verify.cjs antes deste arquivo para atualizar as vistas.
"""
import json
import hashlib
import subprocess
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output/pdf"
OUT.mkdir(parents=True, exist_ok=True)
cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
verification = json.loads((ROOT / "output/verification.json").read_text(encoding="utf-8"))
if verification["status"] != "passed" or verification["consoleErrors"]:
    raise RuntimeError("Conclua a verificação do modelo antes de exportar o PDF.")
if verification.get("config") != cfg or verification.get("htmlHash") != hashlib.sha256((ROOT/"index.html").read_bytes()).hexdigest():
    raise RuntimeError("Configuração ou HTML mudou. Execute verify.cjs para atualizar as vistas antes de exportar.")
layout = verification["layout"]
check = subprocess.run(["node", "-e", "const fs=require('fs'),m=require('./src/layout.js');const c=JSON.parse(fs.readFileSync('config.json','utf8'));console.log(JSON.stringify(m.bom(c,m.calculate(c))));"],
                       cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
bom = json.loads(check.stdout)
font_dir = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("UI", str(font_dir / "segoeui.ttf")))
pdfmetrics.registerFont(TTFont("UI-Bold", str(font_dir / "segoeuib.ttf")))
pdfmetrics.registerFontFamily("UI", normal="UI", bold="UI-Bold")
INK = colors.HexColor("#233943")
MUTED = colors.HexColor("#60737a")
ORANGE = colors.HexColor("#ef4c23")
LINE = colors.HexColor("#d7dfdd")
W, H = landscape(A4)
styles = {
    "title": ParagraphStyle("title", fontName="UI-Bold", fontSize=27, leading=32, textColor=INK, spaceAfter=8),
    "subtitle": ParagraphStyle("subtitle", fontName="UI", fontSize=11, leading=16, textColor=MUTED, spaceAfter=12),
    "body": ParagraphStyle("body", fontName="UI", fontSize=10, leading=15, textColor=INK, spaceAfter=8),
    "small": ParagraphStyle("small", fontName="UI", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=6),
    "table": ParagraphStyle("table", fontName="UI", fontSize=8, leading=11, textColor=INK),
    "head": ParagraphStyle("head", fontName="UI-Bold", fontSize=9, leading=12, textColor=INK),
    "section": ParagraphStyle("section", fontName="UI-Bold", fontSize=14, leading=19, textColor=INK, spaceAfter=8),
}
def p(text, style="body"):
    return Paragraph(text, styles[style])

def shot(name, maxw, maxh):
    from PIL import Image as PILImage
    path = ROOT / "output/views" / (name + ".png")
    with PILImage.open(path) as im:
        scale = min(maxw / im.width, maxh / im.height)
        return Image(str(path), width=im.width*scale, height=im.height*scale)

def title(name, subtitle):
    return [p(name, "title"), p(subtitle, "subtitle")]

def table(rows, widths, head=True):
    data = [[p(str(v), "head" if head and i == 0 else "table") for v in row] for i, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eeeb") if head else colors.white),
        ("LINEBELOW", (0, 0), (-1, -1), .4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

def columns(left, right, widths):
    t = Table([[left, right]], colWidths=widths)
    t.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (0,0), (-1,-1), 14)]))
    return t

def decorate(c, doc):
    c.saveState()
    c.drawImage(str(ROOT / "assets/logo-ctech-claro.png"), 36, H-47, width=126, height=24.48, mask="auto")
    c.setFillColor(MUTED); c.setFont("UI", 8)
    c.drawRightString(W-36, H-34, "CT / MOD-02  |  ESTUDO CONCEITUAL  |  15 OUT 2026")
    c.setStrokeColor(ORANGE); c.setLineWidth(1); c.line(36, 32, W-36, 32)
    c.setFont("UI", 8); c.drawString(36, 18, "Equipamentos genéricos. Sem certificação IP ou dimensionamento executivo.")
    c.drawRightString(W-36, 18, f"CTech  /  {doc.page:02d}")
    c.restoreState()

story = []
story += title("Estações modulares.", "Revisão 02 - Caixas nas medidas informadas, organização e cabos editáveis | Cliente e local: a confirmar")
story.append(shot("iso", W-72, 344))
story.append(Spacer(1, 9))
story.append(p("<b>Telecom:</b> 600 × 400 × 600 mm = 0,60 × 0,40 × 0,60 m; altura externa ≈ 9,00 U.<br/><b>Energia:</b> 700 × 600 × 600 mm = 0,70 × 0,60 × 0,60 m; altura externa ≈ 13,50 U.<br/>Ordem L × A × P. 1 U = 44,45 mm. Conversão da altura externa, sem indicar capacidade útil de rack. Reserva: 25% do painel central útil.", "small"))
story.append(PageBreak())

story += title("01 / Caixa Telecom", "Vista frontal interna. Portas e laterais ocultas para permitir a inspeção.")
story.append(columns([
    p("De baixo para cima", "section"),
    p("Entradas inferiores separadas de fibra, Ethernet e alimentação. ONU em suporte próprio, switch de rede ao centro e switch PoE acima. Folga inicial entre blocos: 20 mm, a validar com os modelos reais."),
    p("Régua na faixa lateral de energia. Reserva de fibra na lateral oposta, com raio ilustrativo de 35 mm."),
    p("A faixa verde ocupa 25% da região central útil, após descontar margens e serviços laterais. Não representa volume livre."),
    p("Manutenção", "section"),
    p("Suportes individuais, conectores voltados para a frente e 600 mm de acesso externo estimado. Confirmar abertura e retirada com equipamentos reais."),
], shot("network", 505, 365), [250, W-72-250]))
story.append(PageBreak())

story += title("02 / Caixa Energia", "Vista frontal interna. Bateria e nobreak lado a lado, em suportes independentes próximos à base.")
story.append(columns([
    p("Autonomia separada", "section"),
    p("Bateria em berço inferior e nobreak ao lado. Essa disposição reduz a altura ocupada. Distribuição lateral e conjunto de proteção em trilho DIN acima dos blocos."),
    p("Entrada → proteção e seccionamento → nobreak → distribuição → interligação protegida → régua Telecom."),
    p("A bateria se conecta ao circuito próprio do nobreak. O DPS integra o conjunto de proteção; sua ligação não está dimensionada."),
    p("A validar", "section"),
    p("Química e massa da bateria, ventilação, compatibilidade com nobreak, esforços dos suportes, condutores, aterramento e proteções."),
], shot("power", 505, 365), [250, W-72-250]))
story.append(PageBreak())

story += title("03 / Envelope e profundidade", "Vistas lateral e superior do conjunto. Use o seletor de módulo no HTML para inspecionar cada caixa.")
story.append(columns([shot("side", 374, 275), p("LATERAL", "head"), p("Mostra profundidade, suportes, conectores e afastamento do painel. Na projeção do conjunto, os módulos se sobrepõem parcialmente.", "small")],
                     [shot("top", 374, 275), p("SUPERIOR INTERNA", "head"), p("Cobertura oculta para mostrar a distribuição em profundidade. Equipamentos mais altos podem encobrir blocos abaixo; gire o modelo para inspecionar.", "small")], [385, W-72-385]))
story.append(p("Medidas externas informadas pelo usuário. Espessura de parede, folgas, canais, beiral e afastamento do painel permanecem genéricos e podem ser alterados na aba Medidas.", "small"))
story.append(PageBreak())

story += title("04 / Fechamento e montagem", "Vista externa e explodido por conjuntos. Separação visual não representa sequência de trabalho com partes energizadas.")
story.append(columns([shot("closed", 374, 275), p("CAIXAS FECHADAS", "head"), p("Portas com fechos, vedação ilustrativa, cobertura e interligação inferior. Dobradiças ficam nas laterais externas.", "small")],
                     [shot("exploded", 374, 275), p("EXPLODIDO POR CONJUNTOS", "head"), p("Carcaça, painel, equipamentos com suportes e porta separados. Ventilação permanece vinculada à carcaça. Cabos são ocultados neste modo.", "small")], [385, W-72-385]))
story.append(p("O controle Separação ajusta a distância visual entre conjuntos. As dimensões dos componentes permanecem iguais.", "small"))
story.append(PageBreak())

story += title("05 / Ar, água e cabeamento", "Fluxos indicativos. A geometria não substitui ensaios de proteção ambiental e avaliação térmica.")
story.append(columns([
    p("Ventilação por módulo", "section"),
    p("Entrada inferior e saída superior com capuz, defletor, tela e filtro. Ventoinha substituível prevista como hipótese, sem vazão definida."),
    p("O ar da caixa de energia não circula pela caixa Telecom. A bateria pode exigir compartimentação e ventilação específicas."),
    p("Chuva e umidade", "section"),
    p("Entradas inferiores por prensa-cabos; cobertura com beiral. Condensação, drenagem, exposição solar e manutenção dos filtros ainda dependem do local."),
    p("Dados e energia", "section"),
    p("Doze conexões funcionais iniciais com origem e destino. Cabos acompanham os equipamentos e podem ser editados. Fontes/adaptadores reais, percursos e raios completos ainda precisam de validação."),
], shot("airflow", 505, 365), [250, W-72-250]))
story.append(PageBreak())

story += title("06 / Lista preliminar de materiais", "BOM do conceito. Quantidades não constituem especificação de compra; componentes elétricos e mecânicos a validar.")
story.append(table([["Componente", "Quantidade", "Critério / pendência"]] + bom, [218, 105, W-72-323]))
story.append(PageBreak())

story += title("07 / Dados necessários para versão final", "Substituir estimativas por medidas, condições de uso e especificações verificadas.")
left = [p("Equipamentos e autonomia", "section")]
for text in [
    "Dimensões e massa do switch PoE, switch, ONU, nobreak e bateria.",
    "Quantidade, química e compatibilidade das baterias com o nobreak.",
    "Tensão de entrada, tensão de saída, potência total e orçamento PoE.",
    "Autonomia desejada e tempo de recarga.",
    "Quantidade de portas/cabos, posição dos conectores e raio mínimo da fibra.",
    "Folgas e orientação de ventilação exigidas pelos fabricantes.",
]: left.append(p("• " + text))
right = [p("Instalação e validação", "section")]
for text in [
    "Cliente, local de instalação e temperatura ambiente máxima.",
    "Chuva, sol, umidade, poeira, maresia e condensação.",
    "Material da caixa, proteção IP desejada e ensaios necessários.",
    "Padrão de fixação e capacidade da parede/poste e dos suportes.",
    "Espaço frontal, abertura das portas e percurso de retirada.",
    "Dimensionamento profissional de proteções, condutores, aterramento e bateria.",
]: right.append(p("• " + text))
story.append(columns(left,right,[385,W-72-385]))
story.append(Spacer(1, 12))
story.append(p("Como evoluir o modelo", "section"))
story.append(p("Na aba Organizar, selecione o equipamento e altere X/Y/Z ou habilite arrastar pela vista frontal. Selecione um cabo para mudar origem, destino e trajeto, ou crie uma ligação entre portas livres. Salvar organização exporta medidas, posições e cabos em JSON. Baixar HTML editado gera um arquivo autônomo com sua organização. Posições incompatíveis são rejeitadas.", "small"))
story.append(p("Base de trabalho: skill rack-3d-ctech. Reutilizados Three.js r128, logo CTech, configuração separada, validação antes da geração e captura de vistas para PDF. A geometria foi adaptada para duas caixas sem padrão de U.", "small"))

output = OUT / "ctech-caixas-modulares.pdf"
doc = SimpleDocTemplate(str(output), pagesize=(W,H), leftMargin=36, rightMargin=36, topMargin=65, bottomMargin=44,
                        title="CTech - Estações modulares - Conceito 02", author="CTech Solutions Tecnologia")
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
print(output)
