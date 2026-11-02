// Hoja de miniaturas: dibuja varias páginas de un PDF en una sola imagen PNG, en rejilla, con el número
// de página del PDF debajo de cada una. Sirve para ver de un vistazo los huecos al pie de página.
// Uso: swift main/herramientas/pdf_hoja_paginas.swift ruta/al.pdf salida.png columnas primera última [escala]
import PDFKit
import AppKit
let args = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: args[1]))!
let salida = args[2]
let columnas = Int(args[3])!
let primera = Int(args[4])!, ultima = Int(args[5])!
let escala: CGFloat = args.count > 6 ? CGFloat(Double(args[6])!) : 0.35
let caja = doc.page(at: primera - 1)!.bounds(for: .mediaBox)
let pw = caja.width * escala, ph = caja.height * escala
let margen: CGFloat = 8, rotulo: CGFloat = 16
let n = ultima - primera + 1
let filas = (n + columnas - 1) / columnas
let ancho = CGFloat(columnas) * (pw + margen) + margen
let alto = CGFloat(filas) * (ph + rotulo + margen) + margen
let img = NSImage(size: NSSize(width: ancho, height: alto))
img.lockFocus()
NSColor(white: 0.75, alpha: 1).set(); NSRect(x: 0, y: 0, width: ancho, height: alto).fill()
let ctx = NSGraphicsContext.current!.cgContext
for k in 0..<n {
    let fila = k / columnas, col = k % columnas
    let x = margen + CGFloat(col) * (pw + margen)
    let y = alto - margen - CGFloat(fila + 1) * (ph + rotulo + margen) + margen + rotulo
    NSColor.white.set(); NSRect(x: x, y: y, width: pw, height: ph).fill()
    ctx.saveGState()
    ctx.translateBy(x: x, y: y)
    ctx.scaleBy(x: escala, y: escala)
    doc.page(at: primera - 1 + k)!.draw(with: .mediaBox, to: ctx)
    ctx.restoreGState()
    let texto = NSAttributedString(string: "\(primera + k)", attributes: [.font: NSFont.boldSystemFont(ofSize: 12)])
    texto.draw(at: NSPoint(x: x + pw / 2 - 8, y: y - rotulo + 1))
}
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: salida))
