import Foundation
import Vision
import CoreImage
import ImageIO

func run() throws {
    guard CommandLine.arguments.count == 3 else { throw NSError(domain:"Cutout",code:1,userInfo:[NSLocalizedDescriptionKey:"Usage: cutout input output.png"]) }
    let source = URL(fileURLWithPath: CommandLine.arguments[1])
    let output = URL(fileURLWithPath: CommandLine.arguments[2])
    let handler = VNImageRequestHandler(url: source, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])
    guard let result = request.results?.first, !result.allInstances.isEmpty else { throw NSError(domain:"Cutout",code:2,userInfo:[NSLocalizedDescriptionKey:"No foreground object detected"]) }
    let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
    let image = CIImage(cvPixelBuffer: buffer)
    try CIContext().writePNGRepresentation(of: image, to: output, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
    print("Saved transparent foreground PNG")
}
do { try run() } catch { fputs("Background removal failed: \(error.localizedDescription)\n",stderr); exit(1) }
