var selected = new ol.Collection();
// var pl = new ol.format.GeoJSON().readFeature({}, { featureProjection: 'EPSG:3857' });
var dp = { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" };
// var view = new ol.View({ center: [ 2345000.0, 6840000.0 ], zoom: 6 });
var view = new ol.View({ center: ol.proj.fromLonLat([ 19.5, 52.0 ]), zoom: 6 });
function viewToExtent(view, extent) { var geo = ol.geom.Polygon.fromExtent(extent);
    view.fit(geo, { padding: [ 10, 10, 10, 10 ], duration: 250 }); }
function olStyle(fg, bg, stroke, cfg, cbg, cr, cstroke) {
    var image = new ol.style.Circle({
        radius: cr || (2 * (cstroke || stroke || 2)),
        fill: new ol.style.Fill({ color: cbg || bg || '#FFF6' }),
        stroke: new ol.style.Stroke({ color: cfg || fg || '#000A', width: cstroke || stroke || 2 }),
    });
    return new ol.style.Style({
        image: image,
        fill: new ol.style.Fill({ color: bg || '#FFF6' }),
        stroke: new ol.style.Stroke({ color: fg || '#000A', width: stroke || 2 })
    });
}
var geolocation = new ol.Geolocation({
    trackingOptions: {
        enableHighAccuracy: true,
    },
    projection: view.getProjection(),
})
var accuracyFeature = new ol.Feature();
accuracyFeature.setStyle(olStyle('#C22A', '#C226', 2));
geolocation.on('change:accuracyGeometry', function() {
    accuracyFeature.setGeometry(geolocation.getAccuracyGeometry()); });
var positionFeature = new ol.Feature();
positionFeature.setStyle(olStyle('#000A', '#C22A', 4));
geolocation.on('change:position', function() {
    var coords = geolocation.getPosition();
    positionFeature.setGeometry(coords ? new ol.geom.Point(coords) : null);
    if (locationChange && coords) { locationChange(ol.proj.toLonLat(coords)); }
});
geolocation.on('error', function(e) { var gl = Spruce.store('geolocation'); gl.state = false; gl.error = e.message; });
var defstyle = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: '#FFF6' }),
        stroke: new ol.style.Stroke({ color: '#000A', width: 2 }),
    }),
    fill: new ol.style.Fill({ color: '#FFF6' }),
    stroke: new ol.style.Stroke({ color: '#000A' }),
});
function colorStyle(base) { return function(f,res) {
    if (f.Color || f.color) {
        var c  = (f.Color || f.color) + (f.Hidden ? '11' : '66');
        var sc = (f.Color || f.color) + (f.Hidden ? '33' : 'AA');
        var s = base.clone();
        switch (f.Type || f.type) {
            case 'Point':
                var img = new ol.style.Circle({
                    radius: s.getImage().getRadius() || 6,
                    fill: new ol.style.Fill({ color: c }),
                    stroke: base.getStroke(),
                });
                const svg = new ol.Image({
                    src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDIwIDIwIiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjogZ3JlZW47Ij48cGF0aCBkPSJtIDEwIDEwIDEwdiAtMTBoIiAvPjwvc3ZnPg=='
                });
                var icon = new ol.style.Icon({
                    color: '#F00F',
                    // src: 'static/icon/icons/' + f.Icon + '.svg',
                    img: svg,
                    size: [ 10, 10 ],
                    imgSize: [ 10, 10 ]
                });
                s.setImage(f.Icon != 'point' ? icon : img);
                console.log(f.Icon)
                s.setZIndex(f.ZIndex || 30)
                break;
            case 'Circle':
                /*
                var rend = drawLayer.createRenderer();
                s.setRenderer(function(coords, state) {
                    //ol.render.Feature('Circle', coords, null)
                /*
                    const [[x, y], [x1, y1]] = coords;
                    const ctx = state.context;
                    const dx = x1 - x;
                    const dy = y1 - y;
                    const radius = Math.sqrt(dx * dx + dy * dy);
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                    ctx.fillStyle = c;
                    ctx.fill();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                    ctx.strokeStyle = '#EC8A';
                    ctx.lineWidth = 5;
                    ctx.stroke();
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#EC83';
                    for (var i = 0; i < 8; i++) {
                        ctx.rotate(45 * Math.PI / 180);
                        ctx.moveTo(radius * .2, 0);
                        ctx.lineTo(radius * .9, 0);
                        ctx.stroke();
                    }
                    ctx.restore();
                });
                break;
                */
                s.setZIndex(f.ZIndex || 25)
            case 'Polygon':
                s.setZIndex(f.ZIndex || 20)
                s.setFill(new ol.style.Fill({ color: c })); break;
            case 'Line':
                s.setZIndex(f.ZIndex || 28)
                s.setStroke(new ol.style.Stroke({ color: sc,
                    width: base.getStroke().getWidth() || 3 })); break;
        }
        return s;
    }
    return base;
} }
var source = new ol.source.Vector({ wrapX: false });
var select = new ol.interaction.Select({
    wrapX: false,
    layers: function(l) { var t = l.get('title'); var f = t == 'Draw'; return f },
    style: colorStyle(new ol.style.Style({
        image: new ol.style.Circle({
            radius: 12,
            fill: new ol.style.Fill({ color: '#FFF6' }),
            stroke: new ol.style.Stroke({ color: '#EC8A', width: 5 }),
        }),
        fill: new ol.style.Fill({ color: '#FFF6' }),
        stroke: new ol.style.Stroke({ color: '#EC8A', width: 5 }),
    })),
});
var modify = new ol.interaction.Modify({
    features: selected,
    // source: source,
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10,
            fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#EC8', width: 4 }),
        }),
        zIndex: Infinity,
    }),
});
modify.on('modifyend', function(e) {
    if (!remoteUpdate) { return; }
    e.features.forEach(function(f) {
        if (f.ID) { remoteUpdate(f); }
    });
});
var SidebarControl = (function(Control) {
    function SidebarControl(options) {
        var opts = options || {};
        var btn = document.createElement('button');
        btn.innerHTML = '&rsaquo;'; btn.title = 'Show sidebar';
        btn.id = 'toggle-sidebar';
        var div = document.createElement('div');
        div.className = 'toggle-sidebar ol-unselectable ol-control';
        div.appendChild(btn);
        Control.call(this, { element: div, target: opts.target });
        btn.addEventListener('click', this.handleSidebar.bind(this), false);
    }
    if (Control) SidebarControl.__proto__ = Control;
    SidebarControl.prototype = Object.create(Control && Control.prototype);
    SidebarControl.prototype.constructor = SidebarControl;
    SidebarControl.prototype.handleSidebar = function handleSidebar() {
        // var sdb = document.getElementById('sidebarData')
        // if (sdb) { sdb.__x.$data.editorOpen = true; }
        if (Alpine) { Alpine.store('sidebar').open = true; sidebarButton(true); }
    }
    return SidebarControl;
}(ol.control.Control));
var mousePosition = new ol.control.MousePosition({ className: 'mouse-position',
    coordinateFormat: ol.coordinate.createStringXY(4),
    // projection: new ol.proj.toLonLat,
    projection: 'EPSG:4326', undefinedHTML: '-',
    target: document.getElementById('position') });
function geoJSONlayer(url, title, zIndex, color, zoom, type) {
    return new ol.layer[type || 'Vector']({
        title: title,
        style: olStyle(color ? color[0] : '#EC8', color ? color[1] : '#000'),
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON(dp),
            url: url
        }),
        zIndex: zIndex,
        minZoom: zoom ? zoom[0] : null,
        maxZoom: zoom ? zoom[1] : null,
    });
}
var warsaw = new ol.layer.Vector({
            title: 'Warsaw',
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: '#0006' }),
                stroke: new ol.style.Stroke({ color: '#EC8A' }),
            }),
            visible: false,
            source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                // url: 'https://raw.githubusercontent.com/andilabs/warszawa-dzielnice-geojson/master/warszawa-dzielnice.geojson',
                url: '/static/warszawa-dzielnice.geojson',
            }),
            zIndex: 5,
        });

var poland = new ol.layer.Vector({
            title: 'Poland',
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: '#0003' }),
                stroke: new ol.style.Stroke({ color: '#EC8', width: 5 }),
            }),
            source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                url: '/static/pl.geojson',
                // features: [ pl ],
            }),
            zIndex: 4,
            maxZoom: 10,
        });
var drawLayer = new ol.layer.Vector({
            title: 'Draw',
            source: source,
            style: colorStyle(defstyle),
            zIndex: 20,
        });
var locationLayer = new ol.layer.Vector({
            title: 'Geolocation',
            source: new ol.source.Vector({ features: [ accuracyFeature, positionFeature ] }),
            zIndex: 101,
        });
var graticule = new ol.layer.Graticule({
            title: 'Graticule',
            strokeStyle: new ol.style.Stroke({
                color: '#EC88',
                width: 2,
                lineDash: [ 0.5, 4 ],
            }),
            wrapX: false,
            zIndex: 100,
        });
graticule.set("skip", true);
var fullscreen = new ol.control.FullScreen();
function hideClass(className, state) {
    var els = document.getElementsByClassName(className);
    for (i in els) { var el = els[i]; hide(el, state); } }
fullscreen.on('enterfullscreen', function() { if (!fullscreen.kiosk) { return; }
    hideClass('ol-control', true); hideClass('ol-scale-line', true); })
fullscreen.on('leavefullscreen', function() { if (!fullscreen.kiosk) { return; }
    hideClass('ol-control', false); hideClass('ol-scale-line', false); })
function setKiosk(s) { fullscreen.kiosk = s; }
var defControls = [
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.Zoom({ zoomOutLabel: '-' }),
        new ol.control.Rotate(),
        fullscreen,
        new ol.control.ScaleLine(),
        mousePosition,
        // new ol.control.ZoomToExtent({ label: 'W', tipLabel: 'WARsaw', extent: warExtent }),
        // new SidebarControl(),
    ];
var minControls = [
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.Zoom({ zoomOutLabel: '-' }),
        new ol.control.Rotate(),
        new ol.control.ScaleLine(),
    ];
var noControls = [ new ol.control.Attribution({ collapsible: true, collapsed: true }) ];

var layers; var ocls = ol.control.LayerSwitcher;
if (ocls) { layers = new ocls({
    tipLabel: 'Layers',
    activationMode: 'click',
}); }
var draw; var snap;
function addInteraction(value) {
    map.removeInteraction(draw);
    map.removeInteraction(snap);
    if (value != 'None') {
        draw = new ol.interaction.Draw({
            source: source,
            type: value,
            // freehand: true,
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: '#FFF6' }),
                stroke: new ol.style.Stroke({ color: '#EC8A', width: 5 }),
            }),
            freehandCondition: ol.events.condition.shiftKeyOnly,
        })
        draw.on('drawend', function(e) { addFeature(e.feature, value); });
        map.addInteraction(draw);
    }
    snap = new ol.interaction.Snap({ source: source });
    map.addInteraction(snap);
}
function getGeo(all) {
    var f = []; var gj = new ol.format.GeoJSON();
    source.forEachFeature(function(ft) { f.push(ft); ft.set('name', ft.name); });
    if (all) {
        console.log(gj.writeFeatures(f, dp));
        return;
    }
    var geo = f[0].getGeometry();
    geo.transform('EPSG:3857', 'EPSG:4326');
    var ft = new ol.Feature({ geometry: geo });
    console.log(gj.writeFeature(ft));
}

var mp = document.getElementsByClassName('mouse-position')
if (mp.length > 0) { mp[0].innerHTML = '-'; }
function updateMapSize() { setTimeout(function() { map.updateSize() }, 300); }
function centerView(f, c) {
    // if (c) { of = new ol.Feature({ geometry: new ol.geom.Point(c) }); }
    if (c) { map.getView().animateInternal({ center: ol.proj.fromLonLat(c), duration: 250 }); return; }
    map.getView().fit(f.getGeometry(), { padding: [ 50, 50, 50, 50 ], duration: 250 }); }
function importPoly(s, f) {
    var pl = s || prompt('Import polyline') || '';
    if (!pl || pl.length == 0) { return; }
    var w = new ol.format.Polyline();
    var fpl = w.readFeature(pl, dp);
    var geo = fpl.getGeometry();
    var coords = geo.getCoordinates();
    if (f) {
        switch (f.Type) {
            case 'Circle':
                fpl = new ol.Feature();
                var r = geo.getLength();
                var gc = new ol.geom.Circle(coords[0], r);
                fpl.setGeometry(gc);
                break;
            case 'Polygon':
                coords[coords.length - 1] = coords[0];
                fpl = new ol.Feature();
                var gp = new ol.geom.Polygon([ coords ]);
                fpl.setGeometry(gp);
                break;
        }
        for (k in f) { fpl[k] = f[k]; }
        var skip;
        if (f.ID) { source.forEachFeature(function(sf) { if (sf.ID == f.ID) { skip = true; } }); } // exit if ID exists
        if (skip) { return; }
    }
    // fpl.getGeometry().transform('EPSG:4326', 'EPSG:3857');
    source.addFeature(fpl);
    // if (geo[0] == geo[geo.length]) { addFeature(fpl, 'Polygon'); return; }
    addFeature(fpl, f ? f.Type : 'LineString');
}

var tooltipEl;
tooltipEl = document.createElement('div');
tooltipEl.className = 'ol-tooltip ol-tooltip-hover';
var tooltip = new ol.Overlay({
    element: tooltipEl,
    offset: [ 0, 30 ],
    positioning: 'top-center',
});
var highlight;
var highlighted = [];
var cursor;
function setCursor() { cursor = new ol.Feature(); source.addFeature(cursor); }
function removeHighlights() { highlighted.forEach(function(f) { f.setStyle(undefined); }); highlighted = []; }
function getMapFeaturesAt(coord, func, layer) {
    var zoom = map.getView().getZoom();
    var c = new ol.geom.Circle(coord,  map.getView().getResolution() * 5);
        // 150000 * Math.exp(-0.5 * zoom)); // 14 -> 100, 10 -> 1000, 9 -> 2000, 8 -> 3000
    if (cursor &&cursor.setGeometry) { cursor.setGeometry(c); }
    var ext = c.getExtent();
    map.getLayers().getArray().forEach(function(l) {
        if (l.get('skip')) { return; }
        if (!l.getSource) { return; }
        var source = l.getSource();
        var name = '';
        if (l.getProperties) { name = l.get('title') || ''; }
        if (layer && layer != name) { return; }
        if (!source.getFeaturesAtCoordinate) { return; }
        if (l.get('visible')) {
            source.getFeaturesAtCoordinate(coord).forEach(function(f) { func(f, name); });
            source.getFeaturesInExtent(ext).forEach(function(f) {
                if (f.getGeometry() instanceof ol.geom.Point) { func(f, name); }});
                // function(f) { return f.getGeometry() instanceof ol.geom.Point })
            if (!(source instanceof ol.source.Vector)) { return; }
            // var f = source.getClosestFeatureToCoordinate(coord);
            // if (f && ol.sphere.getDistance(coord, f.getGeometry().getCoordinates()) < 100) { func(f, name); }
        }
    });
}
var tooltipFunc;
function pointerMove(e) {
    var uc = []; var fl = [];
    removeHighlights();
    getMapFeaturesAt(e.coordinate, function(f, name) {
        if (highlight) { highlighted.push(f); f.setStyle(highlight); } f.layer = name;
        uc.push(f.Name || f.name || f.Type || f.type || f.get('name') || name); fl.push(f);
    });
    var ucj = uc.join('<br />');
    var tip = tooltipFunc ? tooltipFunc(fl, uc) || ucj : ucj;
    tooltipEl.innerHTML = tip;
    tooltip.setPosition(e.coordinate);
    if (tip.length > 0) { tooltipEl.classList.remove('hidden'); }
    else { tooltipEl.classList.add('hidden');
    }
}
function addTooltip(map, func, color) {
    tooltipFunc = func || tooltipFunc;
    if (color) {
        highlight = new ol.style.Style({
            fill: new ol.style.Fill({ color: color && typeof(color) == 'object' ? color[1] : '#EC86' }),
            stroke: new ol.style.Stroke({ color: color && typeof(color) == 'object' ? color[0] : '#EC8' }),
        });
    }
    map.addOverlay(tooltip);
    map.on('pointermove', pointerMove);
    map.getViewport().addEventListener('mouseout', function() {
        removeHighlights(); tooltipEl.classList.add('hidden'); });
}
function clickHandler(func, layer) {
    map.on('click', function(e) { var uc = [];
        getMapFeaturesAt(e.coordinate, function(f, name) {
            f.layer = name; uc.push(f); }, layer); func(uc); });
}
var osm = new ol.layer.Tile({ source: new ol.source.OSM() });
function hide(el, state) {
    if (!el.classList) { return; }
    if (!state) { el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
}
function redraw() { drawLayer.changed(); }
