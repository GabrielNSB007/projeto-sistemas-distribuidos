import PDFDocument from 'pdfkit';
import fs from "node:fs"


export default function convertTxtToPdf(file: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument()
        const output = fs.createWriteStream(outputPath)

        output.on("finish", resolve)
        output.on("error", reject)
        doc.on("error", reject)

        doc.pipe(output)
        doc.fontSize(12).text(file.toString('utf-8'))
        doc.end()
        })
    

}