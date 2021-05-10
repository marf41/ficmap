var selected = new ol.Collection();
// var pl = new ol.format.GeoJSON().readFeature({}, { featureProjection: 'EPSG:3857' });
var dp = { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" };
var view = new ol.View({ center: [ 2345000.0, 6840000.0 ], zoom: 6 });
var warView = new ol.View({ center: [ 2345000.0, 6840000.0 ], zoom: 12 });
var warExtent = [ 2313000.0, 6870000.0, 2375000.0, 6815000.0 ];
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
positionFeature.setStyle
geolocation.on('change:position', function() {
    var coords = geolocation.getPosition();
    positionFeature.setGeometry(coords ? new ol.geom.Point(coords) : null);
    if (locationChange && coords) { locationChange(coords); }
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
        var sdb = document.getElementById('sidebarData')
        if (sdb) { sdb.__x.$data.editorOpen = true; }
    }
    return SidebarControl;
}(ol.control.Control));
var mousePosition = new ol.control.MousePosition({ className: 'mouse-position',
    coordinateFormat: ol.coordinate.createStringXY(4),
    // projection: new ol.proj.toLonLat,
    projection: 'EPSG:4326', undefinedHTML: '-',
    target: document.getElementById('position') });
function geoJSONlayer(url, title, zIndex, color) {
    style = new ol.style.Style({
        fill: new ol.style.Fill({ color: color ? color[1] : '#000' }),
        stroke: new ol.style.Stroke({ color: color ? color[0] : '#EC8' }),
    });
    return new ol.layer.Vector({
        title: title,
        style: style,
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: url
        }),
        zIndex: zIndex,
    });
}
var warsaw = new ol.layer.Vector({
            title: 'Warsaw',
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: '#0006' }),
                stroke: new ol.style.Stroke({ color: '#EC8A' }),
            }),
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
                fill: new ol.style.Fill({ color: '#0006' }),
                stroke: new ol.style.Stroke({ color: '#EC8', width: 5 }),
            }),
            source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                url: '/static/pl.geojson',
                // features: [ pl ],
            }),
            zIndex: 4,
        });
var drawLayer = new ol.layer.Vector({
            title: 'Draw',
            source: source,
            style: colorStyle(defstyle),
            zIndex: 10,
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
var defControls = [
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.Zoom({ zoomOutLabel: '-' }),
        new ol.control.Rotate(),
        new ol.control.FullScreen(),
        new ol.control.ScaleLine(),
        mousePosition,
        new ol.control.ZoomToExtent({ tipLabel: 'Warsaw', extent: warExtent }),
        new SidebarControl(),
    ];
var minControls = [
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.Zoom({ zoomOutLabel: '-' }),
        new ol.control.Rotate(),
        new ol.control.ScaleLine(),
    ];
var noControls = [ new ol.control.Attribution({ collapsible: true, collapsed: true }) ];

var layers; var ocls = ol.control.LayerSwitcher;
if (ocls) { layers = new ocls({ tipLabel: 'Layers' }); }
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
function getGeo() {
    var f = [];
    source.forEachFeature(function(ft) { f.push(ft) });
    var geo = f[0].getGeometry();
    geo.transform('EPSG:3857', 'EPSG:4326');
    var ft = new ol.Feature({ geometry: geo });
    var gj = new ol.format.GeoJSON();
    console.log(gj.writeFeature(ft));
}

var mp = document.getElementsByClassName('mouse-position')
if (mp.length > 0) { mp[0].innerHTML = '-'; }
function updateMapSize() { setTimeout(function() { map.updateSize() }, 300); }
function centerView(f) { map.getView().fit(f.getGeometry(), { padding: [ 50, 50, 50, 50 ], duration: 250 }); }
function importPoly() {
    var pl = prompt('Import polyline') || ''; if (!pl || pl.length == 0) { return; }
    var w = new ol.format.Polyline();
    var fpl = w.readFeature(pl, dp);
    // fpl.getGeometry().transform('EPSG:4326', 'EPSG:3857');
    source.addFeature(fpl); var geo = fpl.getGeometry();
    // if (geo[0] == geo[geo.length]) { addFeature(fpl, 'Polygon'); return; }
    addFeature(fpl, 'LineString');
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
function removeHighlights() { highlighted.forEach(function(f) { f.setStyle(undefined); }); highlighted = []; }
function getMapFeaturesAt(coord, func, layer) {
    map.getLayers().getArray().forEach(function(l) {
        if (!l.getSource) { return; }
        var source = l.getSource();
        var name = '';
        if (l.getProperties) { name = l.get('title') || ''; }
        if (!source.getFeaturesAtCoordinate) { return; }
        source.getFeaturesAtCoordinate(coord).forEach(function(f) {
            if (!layer || layer == name) { func(f, name); }
        });
    });
}
var tooltipFunc;
function pointerMove(e) {
    var uc = []; var fl = [];
    removeHighlights();
    getMapFeaturesAt(e.coordinate, function(f, name) {
        if (highlight) { highlighted.push(f); f.setStyle(highlight); } f.layer = name;
        uc.push(f.name || f.type || f.get('name') || name); fl.push(f);
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
