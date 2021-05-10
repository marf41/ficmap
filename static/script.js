// var pl = new ol.format.GeoJSON().readFeature({}, { featureProjection: 'EPSG:3857' });
window.Spruce.store('selected', []);
window.Spruce.store('mode', 'Draw');
window.Spruce.store('logged', { status: '', user: '' });
window.Spruce.store('features', [], true);
var selected = new ol.Collection();
var socket = io();
var dp = { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" };
socket.on("connect", () => { socket.send("Connect."); console.log("Socket connected."); });
socket.on("message", data => { console.log(data); });
socket.on("logged", data => { if (data != 'OK') { Spruce.store('logged').status = 'Wrong user or password.'; } });
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
    if (f.color) {
        var s = base.clone();
        switch (f.type) {
            case 'Point':
                var img = new ol.style.Circle({
                    radius: s.getImage().getRadius() || 6,
                    fill: new ol.style.Fill({ color: f.color + '66' }),
                    stroke: base.getStroke()
                });
                s.setImage(img);
                break;
            case 'Circle':
            case 'Polygon':
                s.setFill(new ol.style.Fill({ color: f.color + '66' })); break;
            case 'Line':
                s.setStroke(new ol.style.Stroke({ color: f.color + 'AA',
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
var SidebarControl = (function(Control) {
    function SidebarControl(options) {
        var opts = options || {};
        var btn = document.createElement('button');
        btn.innerHTML = '&rsaquo;'; btn.title = 'Show sidebar';
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
        document.getElementById('sidebarData').__x.$data.editorOpen = true;
    }
    return SidebarControl;
}(ol.control.Control));
var mousePosition = new ol.control.MousePosition({ className: 'mouse-position',
    coordinateFormat: ol.coordinate.createStringXY(4),
    // projection: new ol.proj.toLonLat,
    projection: 'EPSG:4326', undefinedHTML: '-',
    target: document.getElementById('position') });
var map = new ol.Map({
    target: 'map',
    layers: [
        new ol.layer.Tile({
            title: 'OSM',
            // type: 'base',
            source: new ol.source.OSM(),
            zIndex: 0,
        }),
        new ol.layer.Vector({
            title: 'Warsaw',
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: '#000' }),
                stroke: new ol.style.Stroke({ color: '#EC8' }),
            }),
            source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                // url: 'https://raw.githubusercontent.com/andilabs/warszawa-dzielnice-geojson/master/warszawa-dzielnice.geojson',
                url: '/static/warszawa-dzielnice.geojson',
            }),
            zIndex: 5,
        }),
        new ol.layer.Vector({
            title: 'PL',
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: '#0006' }),
                stroke: new ol.style.Stroke({ color: '#EC8', width: 5 }),
            }),
            source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                url: '/static/pl.geojson',
                // features: [ pl ],
            }),
            zIndex: 4,
        }),
        new ol.layer.Tile({
            title: 'Toner',
            source: new ol.source.Stamen({
                layer: 'toner',
            }),
            zIndex: 1,
        }),
        new ol.layer.Vector({
            title: 'Draw',
            source: source,
            style: colorStyle(defstyle),
            zIndex: 10,
        }),
        new ol.layer.Graticule({
            title: 'Graticule',
            strokeStyle: new ol.style.Stroke({
                color: '#EC88',
                width: 2,
                lineDash: [ 0.5, 4 ],
            }),
            wrapX: false,
            zIndex: 100,
        }),
    ],
    view: new ol.View({
        center: [ 2345000.0, 6840000.0 ],
        zoom: 6
    }),
    controls: [
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.Zoom({ zoomOutLabel: '-' }),
        new ol.control.Rotate(),
        new ol.control.FullScreen(),
        new ol.control.ScaleLine(),
        mousePosition,
        new ol.control.ZoomToExtent({ tipLabel: 'Warsaw', extent: [ 2313000.0, 6870000.0, 2375000.0, 6815000.0 ] }),
        new SidebarControl(),
    ],
});
var layers = new ol.control.LayerSwitcher({
    tipLabel: 'Layers',
});
map.addControl(layers);
map.addInteraction(modify);
map.addInteraction(select);
select.on('select', function(e) {
    if (e.deselected) { e.deselected.forEach(function(s) { selected.remove(s) }); }
    if (e.selected) { e.selected.forEach(function(s) { selected.push(s) }); }
    selectFeatures();
});
function selectFeatures() {
    // var sfl = document.getElementById('featuresList').__x.$data.selected;
    // var sel = document.getElementById('editList').__x.$data.selected;
    // sfl.length = 0; sel.length = 0;
    var sel = Spruce.store('selected'); sel.length = 0;
    selected.forEach(function(s) { if (!s.units) { s.units = {}; } sel.push(s); })
        // sfl.push(s); sel.push(s); });
}
modify.on('modifyend', function(e) {
    e.features.forEach(function(f) { getData(f); f.info = geometryInfo(f); });
    selectFeatures();
});
function getData(f) {
    var geo = f.getGeometry();
    f.coords = []; f.units = {};
    if (geo.getCoordinates) { f.coords = geo.getCoordinates() || []; }
    if (f.coords.length == 1) { f.coords = f.coords[0]; }
    switch(f.type) {
        case 'Point':
            f.coords = [ f.coords ]; break;
        case 'Circle':
            f.units.r = 'm'; var c = geo.getCenter();
            f.coords.push([ c[0], c[1] ] ); f.r = roundPlaces(geo.getRadius(), 3); break;
    }
    f.coords.forEach(function(c) { var l = ol.proj.toLonLat(c);
        c[0] = roundPlaces(l[0], 6); c[1] = roundPlaces(l[1], 6); });
}
var draw; var snap;
function addFeature(ef, value) {
    last = ef;
    ef.type = value;
    var icons = {};
    setupTools().toolsSec.forEach(function(t) { icons[t.value] = t.icon; })
    ef.icon = icons[value];
    ef.info = geometryInfo(ef);
    getData(ef);
    document.getElementById('featuresList').__x.$data.features.push(ef);
}
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
addInteraction('None');
function getGeo() {
    var f = [];
    source.forEachFeature(function(ft) { f.push(ft) });
    var geo = f[0].getGeometry();
    geo.transform('EPSG:3857', 'EPSG:4326');
    var ft = new ol.Feature({ geometry: geo });
    var gj = new ol.format.GeoJSON();
    console.log(gj.writeFeature(ft));
}

function setupTools() {
    return {
        current: {},
        tools: [
            { value: 'None', symbol: '-', icon: 'click', tooltip: 'Select' },
            { value: 'Import', symbol: 'I', icon: 'file-import', tooltip: 'Import Polyline' },
            { value: 'Undo', symbol: 'U', hide: true, tooltip: 'Remove last point', icon: 'arrow-back' },
        ],
        toolsSec: [
            { value: 'Point', symbol: 'P', tooltip: 'Point', icon: 'point' },
            { value: 'LineString', symbol: 'L', show: 'Undo', tooltip: 'Line', icon: 'line' },
            { value: 'Circle', symbol: 'C', icon: 'circle' },
            { value: 'Polygon', symbol: 'P', show: 'Undo', icon: 'perspective' },
        ],
    }
}
function setTool(tool) {
    if (tool.value == 'Undo') { draw.removeLastPoint(); return }
    if (tool.value == 'Import') { importPoly(); return }
    addInteraction(tool.value);
}
function removeFeature(f) {
    source.removeFeature(f)
    var list = document.getElementById('featuresList').__x.$data.features;
    var n = list.indexOf(f);
    if (n >= 0) { list.splice(n, 1); }
}
function roundPlaces(n, p) { var d = Math.pow(10, p); return Math.round(n * d) / d; }
function area(a) {
    if (a > 100000) {
        return roundPlaces(a / 1000000, 2) + ' km<sup>2</sup>';
    } else { return roundPlaces(a, 2) + ' m<sup>2</sup>'; }
}
function lineLength(l) {
    if (l > 1000) { return roundPlaces(l / 1000, 3) + ' km'; }
    else { return roundPlaces(l, 2) + ' m'; }
}
function geometryInfo(f) {
    var g = f.getGeometry()
    var info = ''; var a; var l;
    if (f.type == 'LineString') { f.type = 'Line'; }
    switch (f.type) {
        // case 'Circle': var r = g.getRadius(); a = Math.PI * r * r; info = area(a); break;
        // case 'Polygon': a = g.getArea(); info = area(a); break;
        case 'Circle':
            g = ol.geom.Polygon.fromCircle(g);
        case 'Polygon': a = ol.sphere.getArea(g); info = area(a); break;
        // case 'Line': l = g.getLength(); info = lineLength(l); break;
        case 'Line': l = ol.sphere.getLength(g); info = lineLength(l); break;
    }
    if (a) { f.area = a; }
    if (l) { f.geoLength = l; }
    return info;
}
var mp = document.getElementsByClassName('mouse-position')
if (mp.length > 0) { mp[0].innerHTML = '-'; }
function updateMapSize() { setTimeout(function() { map.updateSize() }, 300); }
function selectFeature(f) { var sf = select.getFeatures(); sf.clear(); sf.push(f);
    selected.clear(); selected.push(f); selectFeatures(); }
function centerView(f) { map.getView().fit(f.getGeometry(), { padding: [ 50, 50, 50, 50 ], duration: 250 }); }
function setupEdit() {
    return {
        current: {},
        selected: [],
        arrows: {},
        unit: {}, mag: '1',
        units: [ { u: 'm', v: 1 }, { u: 'km', v: 1000 } ],
        arrowIcons: { l: 'caret-left', r: 'caret-right', u: 'caret-up', d: 'caret-down' },
        className(tool) { return (this.current == tool ? 'tool-active ' : '') + (tool.icon ? 'ti ti-' + tool.icon : '') },
        tools: [
            { value: 'Center view', icon: 'focus-2', action(t,f,e) { centerView(f) } },
            { value: 'Rename', icon: 'edit', action(t,f,e) { f.name = prompt("New name") || f.name; selectFeatures(); } },
            { value: 'Get code', icon: 'code', action(t,f,e) { var c; var r;
                /*
                var geo = f.clone().getGeometry(); geo.transform('EPSG:3857', 'EPSG:4326');
                if (f.type == 'Circle') { c = geo.getCenter(); r = geo.getRadius();
                    var p = new ol.geom.Point(c); geo = p; }
                var ft = new ol.Feature({ geometry: geo }); var gj = new ol.format.GeoJSON();
                if (f.type == 'Circle') { ft.set('circle', c); ft.set('radius', r); }
                if (f.name) { ft.set('name', f.name); }
                console.log(gj.writeFeature(ft)); } },
                */
                ft = f.clone(); // ft.getGeometry().transform('EPSG:3857', 'EPSG:4326');
                var w = new ol.format.Polyline();
                var pl = w.writeFeature(ft, dp); poly = pl;
                console.log(pl); prompt('Exported polyline', pl); } },
        ],
        fields: [
            { type: 'Circle', props: [ 'r' ] },
        ],
    };
}
function importPoly() {
    var pl = prompt('Import polyline') || ''; if (!pl || pl.length == 0) { return; }
    var w = new ol.format.Polyline();
    var fpl = w.readFeature(pl, dp);
    // fpl.getGeometry().transform('EPSG:4326', 'EPSG:3857');
    source.addFeature(fpl); var geo = fpl.getGeometry();
    // if (geo[0] == geo[geo.length]) { addFeature(fpl, 'Polygon'); return; }
    addFeature(fpl, 'LineString');
}

function init() { console.log(Spruce.store("features").length) }
function updateFeature(f,e) {
    if (e && f[e.target.name]) { f[e.target.name] = e.target.value; }
    var geo = f.getGeometry(); var styleTrg; var style = f.style;
    if (!style) { style = defstyle.clone(); }
    f.coords.forEach(function(c) {
        c[0] = roundPlaces(c[0], 6);
        c[1] = roundPlaces(c[1], 6); })
    switch (f.type) {
        case 'Circle':
            var r = +(f.r);
            if (r <= 0) { f.r = 0.1; r = 0.1; }
            var c = ol.proj.fromLonLat([ +(f.coords[0][0]), +(f.coords[0][1]) ]);
            geo.setCenter(c); geo.setRadius(r); break;
        case 'Polygon':
            var crd = [];
            f.coords.forEach(function(c) { crd.push(ol.proj.fromLonLat(c)); });
            geo.setCoordinates([ crd ]);
            break;
        case 'Line':
            var crd = [];
            f.coords.forEach(function(c) { crd.push(ol.proj.fromLonLat(c)); });
            geo.setCoordinates(crd);
            break;
        case 'Point':
            var c = ol.proj.fromLonLat(f.coords[0]); geo.setCoordinates(c);
            break;
    }
    f.info = geometryInfo(f);
    // selectFeatures();
    forceUpdate();
}
function moveCoord(f, n, dir, val, unit) {
    if (!f.coords[n]) { return }
    var d = [ 0, 0 ]; var v = val * (unit || this.units[0]).v;
    switch (dir) {
        case 'l': d[0] = -(v); break;
        case 'r': d[0] = +(v); break;
        case 'u': d[1] = +(v); break;
        case 'd': d[1] = -(v); break;
    }
    ol.coordinate.add(f.coords[n], ol.proj.toLonLat(d))
    updateFeature(f);
}
function forceUpdate() {
    var sel = Spruce.store('selected'); var e = { units: {}, empty: true }; sel.push(e); sel.splice(sel.indexOf(e), 1);
}
function niceInfo(f) {
    if (!f.area && !f.geoLength) { return '' }
    var kmsq = 1000000; var mmsq = Math.pow(10, 12); var km = 1000; var mm = 1000000;
    var dmag = [
        [ 'Hobbits (height).' ],
        [ 'widths of NBA basketball court.', 15.24 ],
        [ 'football fields.', 105 ],
        [ 'Chopin Airport\'s runways.', 3690 ],
        [ 'marathons.', 42195 ],
        [ 'distances from Zgierz to Warsaw.', 117 * km ],
        [ 'lengths of Poland (N-S).', 649 * km ],
        [ 'lengths of Great Wall of China.', 6.4 * mm ],
        [ 'lengths of Trans-Siberian railway.', 9.289 * mm ],
        [ 'widths of Saturn\'s rings.', 115 * mm ],
    ];
    var amag = [
        [ 'A0 pages.' ],
        [ 'parking spaces.', 6 * 3.6 ],
        [ 'tennis courts.', 261 ],
        [ 'Olympic-size swimming pools.', 1250 ],
        [ 'soccer fields.', 7140 ],
        [ 'areas of Vacitian City.', 490000 ],
        [ 'areas of Żoliborz.', 8.47 * kmsq],
        [ 'areas of Praga-Północ.', 11.42 * kmsq ],
        [ 'areas of Warszawa.', 517 * kmsq ],
        [ 'areas of Aglomeracja Warszawska.', 2730 * kmsq ],
        [ 'areas of Świętokrzyskie.', 11711 * kmsq ],
        [ 'areas of Poland.', 322000 * kmsq ],
        [ 'areas of Egypt.' ],
        [ 'areas of Canada.' ],
        [ 'land areas of Earth.', 150 * mmsq ],
    ];
    var ord = Math.floor(Math.log(f.area || f.geoLength) / Math.LN10 + 0.000000001);
    var p; var ret;
    if (f.area) { amag.forEach(function(a) {
            var av = a[1] || Math.pow(10, amag.indexOf(a)); var r = f.area / av;
            if (p && !ret && r < 1) { ret = roundPlaces(p.r, 3) + ' ' + p.a[0]; }
            p = { r: r, a: a }; }); }
    if (f.geoLength) { dmag.forEach(function(d) {
            var dv = d[1] || Math.pow(10, dmag.indexOf(d)); var r = f.geoLength / dv;
            if (p && !ret && r < 1) { ret = roundPlaces(p.r, 3) + ' ' + p.d[0]; }
            p = { r: r, d: d }; }); }
    if (ret) { return ret; }
    if (f.area && amag[ord]) {
        var a = amag[ord][1] || Math.pow(10, ord);
        return roundPlaces(f.area / a, 3) + ' ' + amag[ord][0];
    }
    if (f.geoLength && dmag[ord]) {
        var d = dmag[ord][1] || Math.pow(10, ord);
        return roundPlaces(f.geoLength / d, 3) + ' ' + dmag[ord][0];
    }
    return ord;
}

var tooltipEl;
tooltipEl = document.createElement('div');
tooltipEl.className = 'ol-tooltip ol-tooltip-hover';
var tooltip = new ol.Overlay({
    element: tooltipEl,
    offset: [ 0, 30 ],
    positioning: 'top-center',
});
map.addOverlay(tooltip);
function pointerMove(e) {
    var uc = [];
    map.getLayers().getArray().forEach(function(l) {
        if (!l.getSource) { return; }
        var source = l.getSource();
        var name = '';
        if (l.getProperties) { name = l.get('title') || ''; }
        if (!source.getFeaturesAtCoordinate) { return; }
        source.getFeaturesAtCoordinate(e.coordinate).forEach(function(f) {
            uc.push(f.name || f.type || f.get('name') || name);
        })
    })
    tooltipEl.innerHTML = uc.join('<br />');
    tooltip.setPosition(e.coordinate);
    if (uc.length > 0) {
        tooltipEl.classList.remove('hidden');
    } else {
        tooltipEl.classList.add('hidden');
    }
}
map.on('pointermove', pointerMove);
map.getViewport().addEventListener('mouseout', function() { tooltipEl.classList.add('hidden'); });
