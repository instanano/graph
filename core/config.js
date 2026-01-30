window.GraphPlotter = window.GraphPlotter || {};
window.minorTickOn = {};
window.useCustomTicksOn = {};
window.overrideScaleformatY = {};

(function (G) {
    G.COLORS = ["#FFFF00", "#000000", "#0000FF", "#FF0000", "#008000", "#00FFFF", "#FF00FF", "#FFA500", "#800080", "#A52A2A"];
    G.DIM = { W: 600, H: 300, MT: 30, MB: 60, ML: 70, MR: 80 };
    G.SYMBOL_TYPES = [d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare, d3.symbolDiamond, d3.symbolStar, d3.symbolCross];
    G.ratioPresets = {
        "4:2.85": { linewidth: 1.4, scalewidth: 1.4, axisTitleFs: 13, legendFs: 13, scaleFs: 12, xticks: 6, yticks: 5, multiygap: 35 },
        "16:9.15": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 11, xticks: 6, yticks: 5, multiygap: 35 },
        "2:1.05": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 11, xticks: 6, yticks: 5, multiygap: 35 },
        "3:1.2": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 10, xticks: 7, yticks: 3, multiygap: 35 },
        "4:1.35": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 10, xticks: 7, yticks: 2, multiygap: 35 }
    };
    G.colEnabled = {};
    G.hot = null;
    G.tickLabelStyles = { x: {}, y: {}, a: {}, b: {}, c: {} };
    G.activeTicks = null;
    G.activeGroup = null;
    G.activeText = null;
    G.activeDiv = null;
    G.activeFo = null;
    G.shapeMode = "none";
    G.drawing = false;
    G.drawStart = null;
    G.tempShape = null;
    G.arrowCount = 0;

    G.getTitles = function (mode) {
        switch (mode) {
            case "uvvis": return { x: "Wavelength (nm)", y: "Absorbance (a.u.)" };
            case "xrd": return { x: "2θ (°)", y: "Intensity (a.u.)" };
            case "ftir": return { x: "Wavenumber (cm<sup>-1</sup>)", y: "Transmittance (%)" };
            case "raman": return { x: "Raman Shift (cm<sup>-1</sup>)", y: "Intensity (a.u.)" };
            case "pl": return { x: "Wavelength (nm)", y: "Intensity (a.u.)" };
            case "xps": return { x: "Binding Energy (eV)", y: "Intensity (cps)" };
            case "tga": return { x: "Temperature (°C)", y: "Weight (%)" };
            case "dsc": return { x: "Temperature (°C)", y: "Heat Flow (mW)" };
            case "bet": return { x: "Relative Pressure (P/P<sub>0</sub>)", y: "Adsorbed Volume (cm<sup>3</sup>·g<sup>-1</sup>)" };
            case "saxs": return { x: "Scattering Vector q (Å<sup>-1</sup>)", y: "Intensity (a.u.)" };
            case "nmr": return { x: "δ (ppm)", y: "Intensity (a.u.)" };
            case "tauc": return { x: "Energy (eV)", y: "(αhν)<sup>n</sup>" };
            case "tensile": return { x: "Strain", y: "Stress" };
            case "ternary": return { a: "A-axis", b: "B-axis", c: "C-axis" };
            default: return { x: "x-axis", y: "y-axis" };
        }
    };
})(window.GraphPlotter);
