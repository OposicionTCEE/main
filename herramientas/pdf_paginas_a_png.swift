import PDFKit
import AppKit
let args = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: args[1]))!
let outDir = args[2]
let scale: CGFloat = CGFloat(Double(args[3]) ?? 1.4)
for a in args[4...] {
    let i = Int(a)! - 1
    let page = doc.page(at: i)!
    let r = page.bounds(for: .mediaBox)
    let w = Int(r.width * scale), h = Int(r.height * scale)
    let img = NSImage(size: NSSize(width: w, height: h))
    img.lockFocus()
    NSColor.white.set(); NSRect(x: 0, y: 0, width: w, height: h).fill()
    let ctx = NSGraphicsContext.current!.cgContext
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)
    img.unlockFocus()
    let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(outDir)/p\(a).png"))
}
