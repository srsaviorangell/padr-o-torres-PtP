# CTech - Estações modulares

Protótipo conceitual de duas caixas independentes: Telecom e Energia. Criado com base na skill **rack-3d-ctech**, adaptada para dimensões livres, sem padrão de U. Data da revisão: 15/10/2026.

## Abrir e usar

Abra `index.html` no Chrome ou Edge. O arquivo contém o Three.js, a logo e todo o modelo; funciona sem internet e pode ser compartilhado sozinho.

1. **Interior** mostra os equipamentos, com portas e laterais ocultas. A vista superior interna também oculta a cobertura.
2. **Caixas fechadas** mostra o envelope, as portas e as entradas inferiores.
3. **Explodido** separa carcaça, painel, equipamentos com suportes e portas. O controle **Separação** ajusta o afastamento ilustrativo. Ventilação continua vinculada à carcaça; os cabos ficam ocultos.
4. Use **Frontal, Lateral, Superior, Fundo ou 3/4**. O seletor de módulo permite inspecionar Telecom ou Energia isoladamente.
5. Clique num equipamento ou na lista para consultar dimensões e critérios de montagem.
6. Na aba **Medidas**, altere valores e pressione **Aplicar medidas**. O modelo conserva a última configuração válida quando encontra incompatibilidades.
7. Use **Salvar configuração** para guardar um JSON e **Carregar configuração** para retomar. Alterações não são gravadas automaticamente no HTML nem entre sessões.
8. **Salvar imagem** exporta a vista atual. As abas inferiores apresentam arquitetura, BOM e dados necessários para versão final.

No canvas: arrastar gira, roda aproxima; teclado: setas giram e `+`/`-` ajustam o zoom.

## Organizar equipamentos e cabos

Na aba **Organizar**, escolha um equipamento e ajuste X/Y/Z, ou habilite **Arrastar equipamentos na vista frontal**. X e Z têm origem no centro da caixa; Y parte da base. São coordenadas do centro do bloco, em mm. Uma posição inválida é recusada, conservando a última válida. **Posição automática** remove a alteração manual daquele equipamento.

Cada cabo possui origem e destino identificados. Escolha o cabo, tipo, portas e ajuste **Desvio lateral** e **Avanço** para organizar o percurso. Use **Novo cabo** para ligar portas livres e **Remover cabo** para desfazer a ligação selecionada. Fibra usa o percurso da reserva óptica; ligações entre caixas seguem o conduíte. Portas incompatíveis ou ocupadas são recusadas.

**Salvar organização** guarda medidas, posições e conexões em JSON. **Baixar HTML editado** cria uma cópia autônoma que já abre com sua organização. O modelo original permanece disponível.

São 12 ligações funcionais iniciais: entrada de fibra até ONU, ONU até switch, switch até PoE, saída Ethernet, entrada elétrica até proteção, proteção até nobreak, bateria até nobreak, nobreak até distribuição, distribuição até régua via conduíte e três alimentações dos equipamentos Telecom. Fontes/adaptadores reais e detalhamento elétrico ainda não estão representados.

## Medidas informadas e premissas

As dimensões externas das caixas foram informadas pelo usuário. Dimensões dos equipamentos e folgas continuam genéricas. Medidas na tabela em milímetros.

| Componente | Largura | Altura | Profundidade |
|---|---:|---:|---:|
| Caixa Telecom | 600 | 400 | 600 |
| Caixa Energia | 700 | 600 | 600 |
| ONU | 150 | 35 | 110 |
| Switch de rede | 280 | 44 | 160 |
| Switch PoE | 300 | 44 | 180 |
| Nobreak | 160 | 230 | 280 |
| Bateria | 230 | 180 | 180 |

Telecom: **0,60 × 0,40 × 0,60 m**, altura externa **≈ 9,00 U**. Energia: **0,70 × 0,60 × 0,60 m**, altura externa **≈ 13,50 U**. Ordem: L × A × P. Conversão por 1 U = 44,45 mm; não indica capacidade útil de rack. Exatamente 9 U medem 400,05 mm, portanto o valor de 9,00 U é arredondado.

Bateria e nobreak ficam lado a lado, próximos à base. Folga inicial entre blocos: 20 mm, ainda dependente dos fabricantes. Distância entre caixas: 240 mm. Reserva de expansão: 25% da área central útil do painel, depois de descontar margens e rotas laterais. Não é reserva volumétrica nem substitui a folga de manutenção. Acesso frontal externo estimado: 600 mm. Raios, portas e cabos são representativos.

O modelo não dimensiona cargas, autonomia, dissipação, corrente, proteções ou grau IP. A química da bateria pode exigir ventilação ou separação adicional. O lugar do switch PoE depende da ventilação do equipamento real. Elementos de fixação, espessuras e material são ilustrativos, sem comprovação estrutural.

## Como a parametrização funciona

- `config.json`: dimensões, folgas, quantidades e premissas em um único ponto.
- `src/layout.js`: calcula posições e reserva de expansão; verifica blocos sobrepostos, largura, altura, profundidade, folgas, bateria, distância entre caixas e espaço da fibra. Também produz a BOM.
- `src/viewer.js`: traduz o resultado em objetos Three.js. Detalhes visuais de fixação estão agrupados em `detail` e não constituem medidas de fabricação.
- `src/cables.js`: define portas, tipos compatíveis e percursos; recalcula as pontas com a posição dos equipamentos.
- `src/editor.js`: edição de posições, criação e remoção de conexões, exportação de JSON e HTML com a organização atual.
- `src/template.html` e `src/style.css`: interface e memorial, preservando a identidade CTech.
- `build.py`: valida a configuração com o mesmo cálculo do visualizador e gera o HTML autônomo.
- `verify.cjs`: verifica comportamentos no Chrome em modo sem janela e salva vistas reais em `output/views`.
- `export_pdf.py`: cria o memorial PDF a partir das vistas verificadas. Recusa capturas de um HTML ou configuração anterior.

As posições são derivadas das medidas, não copiadas manualmente para cada vista. O cálculo não é um solucionador universal de arranjo: se as peças deixam de caber, solicita ajuste explícito em vez de redimensionar silenciosamente os equipamentos.

## Reconstruir

Requisitos: Python 3, Node.js; para verificar e exportar, Chrome, Playwright para Node, ReportLab e Pillow para Python. No ambiente original, usam-se os runtimes já fornecidos pelo Codex. A variável `CODEX_NODE_MODULES` pode indicar a pasta de pacotes Node em outra máquina.

```powershell
python build.py
node verify.cjs
python export_pdf.py
```

O PDF está em `output/pdf/ctech-caixas-modulares.pdf`. Para manter os arquivos de desenvolvimento, compartilhe o ZIP completo. Para apenas visualizar, basta o HTML.

## Origem e validação

Reutilizados da skill rack-3d-ctech: Three.js r128, logo CTech, configuração separada, validação antes de gerar, seleção de componentes, vistas e processo de captura para PDF. O template original exige rack único de 19 polegadas; esta variante adapta o modelo para o briefing aprovado. A skill instalada não foi modificada.

Three.js é distribuído sob licença MIT; consulte `assets/THREE-LICENSE.txt`. A marca CTech permanece identificada no projeto.

Consulta técnica preliminar feita na etapa de arquitetura:

- [nVent HOFFMAN - condições ambientais e proteção do invólucro](https://go.nvent.com/rs/760-EGW-100/images/Technical_Information_nVent_HOFFMAN.pdf)
- [nVent HOFFMAN - seleção e validação da ventilação](https://www.nvent.com/sites/default/files/acquiadam_assets/2021-05/Cat-00059_Chapter8.pdf)
- [Schneider Electric - exemplo de compatibilidade de bateria externa com nobreak](https://www.se.com/us/en/download/document/SPD_SCON-9M2RQM_EN/)

Essas referências orientam as pendências; não certificam o conjunto desenhado.
