/* SalaamStreet — loads Mozilla pdf.js (vendored, unmodified legacy build of
   pdfjs-dist 6.4.299, Apache-2.0: see LICENSE in this folder) and hands it to
   the classic scripts as window.pdfjsLib. js/offline.js adds this module only
   when someone first downloads or opens the Qur'an PDF. */
import * as pdfjsLib from "./pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.min.mjs", import.meta.url).href;
window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new Event("ss:pdfjs"));
