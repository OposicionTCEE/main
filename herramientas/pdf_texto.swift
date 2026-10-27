// Extrae el texto de un PDF con PDFKit (en el Mac no hay pdftotext). Uso: swift main/herramientas/pdf_texto.swift fichero.pdf > salida.txt
import Foundation
import PDFKit
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else { print("No se pudo abrir"); exit(1) }
for i in 0..<doc.pageCount {
    print("=== Página \(i + 1)")
    print(doc.page(at: i)?.string ?? "")
}
