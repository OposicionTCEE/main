import PDFKit
import Foundation
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let doc = PDFDocument(url: url)!
for i in 0..<doc.pageCount {
    let p = doc.page(at: i)!
    let t = p.string ?? ""
    let n = t.split(separator: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count
    let first = t.split(separator: "\n").first.map(String.init) ?? ""
    print("\(i+1)\t\(p.label ?? "")\t\(n)\t\(first.prefix(60))")
}
