(function(G) {
    "use strict";
    const GRAPH_UPSELL = {
        xrd: {paid: "product/xrd-data-matching-online/", msg: ["Plotting XRD data? Get expert phase matching against verified reference databases.", "XRD peaks plotted! Need accurate identification for your materials?", "Beautiful XRD graph! Reviewers often ask for proper phase matching with reference cards.", "Need more than a plot? Get professional phase identification and peak assignment.", "XRD data ready! Our experts can match your peaks to thousands of known compounds."]},
        ftir: {paid: "product/ftir-data-matching-online/", msg: ["FTIR spectrum looks great! Need automated compound identification?", "Plotting FTIR? Get your peaks matched against 10,000+ reference materials.", "Beautiful transmittance plot! Want to identify functional groups automatically?", "FTIR graph ready! Our experts can match your peaks to known compounds.", "Nice FTIR spectrum! Reviewers love seeing compound matches with similarity scores."]},
        xps: {paid: "product/xps-analysis-online/", msg: ["Plotting XPS data? Get professional peak deconvolution and fitting.", "XPS spectrum ready! Need atomic percentages and oxidation state analysis?", "Great binding energy plot! Our experts can deconvolute overlapping peaks.", "XPS graph looks good! Want publication-ready peak assignments?", "Need more than a plot? Get full XPS analysis with chemical state identification."]},
        raman: {paid: "product/raman-crystallite-size-calculator/", msg: ["Raman spectrum plotted! Need ID/IG ratio and crystallite size analysis?", "Working with carbon materials? Get expert D and G band deconvolution.", "Nice Raman plot! Reviewers often ask for proper peak fitting.", "Raman data ready! Our experts can calculate defect density and crystallite size.", "Beautiful Raman spectrum! Want Tuinstra-Koenig analysis for your publication?"]},
        uvvis: {paid: "product/band-gap-calculation-from-tauc-plot/", msg: ["UV-Vis spectrum ready! Need accurate band gap from Tauc plot?", "Plotting absorbance data? Get publication-ready Tauc plot analysis.", "Nice UV-Vis spectrum! Reviewers expect proper band gap determination.", "UV-Vis data plotted! Our experts can calculate direct/indirect band gaps.", "Absorbance graph looks good! Want professional Tauc plot fitting?"]},
        tauc: {paid: "product/band-gap-calculation-from-tauc-plot/", msg: ["Generating Tauc plot? Let our experts ensure accurate band gap values.", "Tauc analysis started! Get professionally fitted linear region extraction.", "Band gap calculation in progress! Reviewers appreciate expert Tauc analysis.", "Need reviewer-ready band gap values? Our experts ensure proper fitting.", "Tauc plot ready! Get verified band gap calculation for your publication."]},
        nmr: {paid: "product/nmr-data-analysis/", msg: ["Plotting NMR spectrum? Get full structural elucidation from your data.", "NMR data loaded! Need peak assignments and purity assessment?", "Nice NMR plot! Our experts can provide complete spectral interpretation.", "Chemical shifts visible! Want professional structure confirmation?", "NMR spectrum ready! Get publication-quality peak assignments."]},
        pl: {paid: "product/custom-analysis/", msg: ["Plotting PL data? Need quantum yield or peak fitting analysis?", "Photoluminescence spectrum ready! Get expert emission peak analysis.", "Nice PL plot! Our analysis team can extract valuable optical properties.", "PL data loaded! Want professional peak deconvolution?", "Beautiful emission spectrum! Get expert analysis for your publication."]},
        dsc: {paid: "product/dsc-percent-crystallinity-calculation-by-our-expert-team/", msg: ["DSC thermogram plotted! Need accurate crystallinity calculation?", "Plotting DSC data? Get professional enthalpy of fusion analysis.", "DSC curve ready! Our experts can calculate percent crystallinity.", "Nice thermal data! Reviewers expect proper baseline integration.", "DSC plot looks good! Get publication-ready crystallinity values."]},
        tga: {paid: "product/custom-analysis/", msg: ["Plotting TGA data? Need thermal stability analysis?", "TGA curve ready! Our experts can analyze decomposition profiles.", "Nice weight loss curve! Get detailed thermal analysis.", "TGA data loaded! Want professional derivative thermogravimetric analysis?", "Thermal data plotted! Get expert interpretation for your manuscript."]},
        bet: {paid: "product/bet-analsysis-online/", msg: ["Plotting BET isotherm? Get surface area and pore analysis.", "BET data loaded! Our experts calculate surface area and pore distribution.", "Nice adsorption plot! Want complete BET analysis with pore shape?", "BET curve ready! Get publication-ready surface area values.", "Isotherm plotted! Need BJH pore size distribution analysis."]},
        saxs: {paid: "product/custom-analysis/", msg: ["Plotting SAXS data? Need particle size distribution analysis?", "SAXS pattern ready! Our experts can extract structural parameters.", "Nice scattering plot! Want professional data fitting?"]},
        tensile: {paid: "product/custom-analysis/", msg: ["Plotting stress-strain curve? Need mechanical property calculations?", "Tensile data ready! Our experts can analyze modulus and yield strength."]},
        default: {paid: "product/scientific-graph-plotting/", msg: ["Great graph! Need publication-quality formatting for journals?", "Nice plot! Our experts create journal-ready 2D/3D scientific figures.", "Data plotted! Want professionally formatted graphs for your paper?", "Graph looks good! We also offer complete data analysis services.", "Beautiful visualization! Need more analysis? Check our expert services."]}
    };
    const GRAPH_UPSELL_STORAGE = "instanano_graph_upsell";
    function storeGraphUpsell() {
        if (sessionStorage.getItem(GRAPH_UPSELL_STORAGE)) return; 
        const axisRadio = document.querySelector('input[name="axistitles"]:checked');
        const axisType = axisRadio ? axisRadio.value : "default"; 
        const upsellData = GRAPH_UPSELL[axisType] || GRAPH_UPSELL.default;
        const randomMsg = upsellData.msg[Math.floor(Math.random() * upsellData.msg.length)];
        const payload = { axis: axisType, paid: upsellData.paid, message: randomMsg, timestamp: Date.now() };
        sessionStorage.setItem(GRAPH_UPSELL_STORAGE, JSON.stringify(payload));
    }
    if (typeof $ !== 'undefined') {
        $('#download').click(storeGraphUpsell); 
        $('#save').click(storeGraphUpsell);
    } else {
        const dl = document.getElementById('download');
        const sv = document.getElementById('save');
        if(dl) dl.addEventListener('click', storeGraphUpsell);
        if(sv) sv.addEventListener('click', storeGraphUpsell);
    }
})(window.GraphPlotter);
