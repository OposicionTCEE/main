// Huecos al pie: en cada página de un PDF, mide el espacio en blanco entre la última línea de texto (o de notas al pie)
// y el número de página, y avisa de las páginas en que supera un umbral. Suele ser una figura o un cuadro que no cabía
// y pasó entero a la página siguiente.
// Uso: swift main/herramientas/pdf_huecos_pie.swift ruta/al.pdf primera última [umbral_cm, 3 por defecto]
import PDFKit
let args = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: args[1]))!
let primera = Int(args[2])!, ultima = Int(args[3])!
let umbral = args.count > 4 ? Double(args[4])! : 3.0
var saltos: [(Int, Double)] = []
for i in (primera - 1)...(ultima - 1) {
    let p = doc.page(at: i)!
    var ys: [CGFloat] = []
    if let sel = p.selection(for: p.bounds(for: .mediaBox)) {
        for l in sel.selectionsByLine() {
            let r = l.bounds(for: p)
            if r.height > 2 { ys.append(r.minY) }
        }
    }
    ys.sort()
    // ys[0] es la línea más baja, el número de página; ys[1], la última línea de texto por encima de él
    saltos.append((i + 1, ys.count > 1 ? Double(ys[1] - ys[0]) : 0))
}
// La distancia normal, la de una página llena, es la mediana de todas
let normal = saltos.map { $0.1 }.sorted()[saltos.count / 2]
var avisos = 0
for (pag, s) in saltos {
    let hueco = (s - normal) * 2.54 / 72
    if hueco >= umbral {
        print("pág. \(pag) del PDF: hueco de \(String(format: "%.1f", hueco)) cm al pie")
        avisos += 1
    }
}
if avisos == 0 { print("Ninguna página con un hueco de \(umbral) cm o más.") }
