window.GraphPlotter = window.GraphPlotter || {
    state: {
        hot: null, colEnabled: {}, activeGroup: null, activeText: null, activeDiv: null, activeFo: null, activeTicks: null,
        tickLabelStyles: {x:{},y:{},a:{},b:{},c:{}}, lastXScale: null, lastYScale: null, multiYScales: null, axisScales: null,
        overrideX: null, overrideMultiY: {}, overrideXTicks: null, overrideYTicks: {}, overrideTernary: {}, overrideTernaryTicks: {},
        overrideScaleformatX: null, overrideScaleformatY: {}, overrideCustomTicksX: null, overrideCustomTicksY: {}, overrideCustomTicksTernary: {},
        minorTickOn: {}, useCustomTicksOn: {}, xrdRefCols: {}, xrdRefSyncing: false, shapeMode: "none", drawing: false, drawStart: null, tempShape: null, arrowCount: 0
    },
    config: {}, utils: {}, ChartRegistry: null, parsers: {}, ui: { refs: {} }, axis: {}, features: {}, init: null, renderChart: null, getSeries: null, getSettings: null
};
(function(G) {
    "use strict";
    G.config.COLORS = ["#FFFF00","#000000","#0000FF","#FF0000","#008000","#00FFFF","#FF00FF","#FFA500","#800080","#A52A2A"];
    G.config.DIM = { W: 600, H: 300, MT: 30, MB: 60, ML: 70, MR: 80 };
    G.config.SYMBOL_TYPES = [d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare, d3.symbolDiamond, d3.symbolStar, d3.symbolCross];
    G.config.ratioPresets = {
        "4:2.85":{linewidth:1.4,scalewidth:1.4,axisTitleFs:13,legendFs:13,scaleFs:12,xticks:6,yticks:5,multiygap:35},
        "16:9.15": { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:11, xticks:6, yticks:5, multiygap:35 },
        "2:1.05":  { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:11, xticks:6, yticks:5, multiygap:35 },
        "3:1.2":   { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:10, xticks:7, yticks:3, multiygap:35 },
        "4:1.35":  { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:10, xticks:7, yticks:2, multiygap:35 }
    };
})(window.GraphPlotter);
