// var pl = new ol.format.GeoJSON().readFeature({}, { featureProjection: 'EPSG:3857' });
var warView = new ol.View({ center: [ 2345000.0, 6840000.0 ], zoom: 12 });
var warExtent = [ 2313000.0, 6870000.0, 2375000.0, 6815000.0 ];
defControls.push(new ol.control.ZoomToExtent({ label: 'W', tipLabel: 'WARsaw', extent: warExtent }));
defControls.push(new SidebarControl());
/*
window.Spruce.store('selected', []);
window.Spruce.store('mode', 'Draw');
window.Spruce.store('logged', { status: '', user: '', admin: false });
window.Spruce.store('features', { list: [] });
window.Spruce.store('geolocation', { state: false, error: '', coords: [ '', '' ] });
function locationChange(c) { c[0] = roundPlaces(c[0], 6); c[1] = roundPlaces(c[1], 6);
    Spruce.store('geolocation').coords = c; }
*/
/*
var socket = io();
socket.on("connect", () => { socket.send("Connect."); console.log("Socket connected."); });
socket.on("message", data => { console.log(data); });
socket.on("logged", data => { if (data != 'OK') { Spruce.store('logged').status = 'Wrong user or password.'; } });
*/
var raster = new ol.source.Raster({
    operation: function(pixels, data) {
        var rgb = pixels[0];
        var avg = (rgb[0] / 255) + (rgb[1] / 255) + (rgb[2] / 255);
        avg = avg / 3; var n = .8; var b = .2;
        n = (1 - avg) * n; if (n < b) { n = b; }
        return [ 238 * n, 204 * n, 136 * n, 255 ];
    },
    sources: [ new ol.source.Stamen({ layer: 'toner' }) ] });
controls = {};
raster.on('beforeoperations', function (event) {
  var data = event.data;
  for (var id in controls) {
    data[id] = Number(controls[id].value);
  }
});
var prewar = geoJSONlayer('/static/warszawa-dzielnice.geojson', 'Pre-war Warsaw', 8, [ '#EC8', '#0006' ], [ 6 ]);
prewar.setVisible(false);
var pois = geoJSONlayer('/static/poi.geojson', 'POIs', 11, [ '#EC8', '#EC86' ]);
var map = new ol.Map({
    target: 'map',
    layers: [
        new ol.layer.Tile({ title: 'OSM', source: new ol.source.OSM(), zIndex: 0, visible: false, type: 'base' }),
        new ol.layer.Image({ title: 'Pre-war world', zIndex: 1, source: raster, type: 'base', visible: true }),
        new ol.layer.Vector({ title: 'None', source: new ol.source.Vector(), zIndex: 2, type: 'base', visible: false }),
        poland,
        // warsaw,
        prewar,
        geoJSONlayer('/static/war.geojson', 'WARsaw', 9, [ '#EC8', '#0006' ], [ 6 ]),
        pois,
        drawLayer,
        locationLayer,
        graticule,
    ],
    view: view,
    controls: defControls,
});
addInteraction('None');
if (layers) { map.addControl(layers); }
map.addInteraction(modify);
map.addInteraction(select);
addTooltip(map);
select.on('select', function(e) {
    if (e.deselected) { e.deselected.forEach(function(s) { selected.remove(s) }); }
    if (e.selected) { e.selected.forEach(function(s) { selected.push(s) }); }
    selectFeatures();
});
function selectFeatures() {
    // var sfl = document.getElementById('featuresList').__x.$data.selected;
    // var sel = document.getElementById('editList').__x.$data.selected;
    // sfl.length = 0; sel.length = 0;
    var sel = Alpine.store('selected'); sel.length = 0;
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
    switch(f.Type) {
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
    if (value == 'Line') { value = 'LineString'; }
    last = ef;
    ef.Type = value;
    var icons = {};
    setupTools().toolsSec.forEach(function(t) { icons[t.value] = t.icon; })
    ef.Icon = ef.Icon || icons[value];
    ef.Color = ef.Color || '#999999';
    ef.info = geometryInfo(ef);
    getData(ef);
    // document.getElementById('featuresList').__x.$data.features.push(ef);
    Alpine.store('features').list.push(ef);
}

function setupTools() {
    return {
        current: {},
        hint: '',
        depthFilter: 2,
        tools: [
            { value: 'None', symbol: '-', icon: 'click', tooltip: 'Select' },
            { value: 'Import', symbol: 'I', icon: 'file-import', tooltip: 'Import Polyline' },
            { value: 'Undo', symbol: 'U', hide: true, tooltip: 'Remove last point', icon: 'arrow-back' },
        ],
        toolsSec: [
            { value: 'Point', symbol: 'P', tooltip: 'Point', icon: 'point' },
            { value: 'LineString', symbol: 'L', show: 'Undo', tooltip: 'Line', icon: 'line',
                hint: 'Double-click on last position to end line.' },
            { value: 'Circle', symbol: 'C', icon: 'circle' },
            { value: 'Polygon', symbol: 'P', show: 'Undo', icon: 'perspective',
                hint: 'Double-click on last position to end polygon.' },
        ],
        setTool(tool) {
            if (tool.value == 'Undo') { draw.removeLastPoint(); return }
            if (tool.value == 'Import') { importPoly(); return }
            this.hint = tool.hint || '';
            addInteraction(tool.value);
        },
        toggleGroup(g,e) {
            var s = e.target.control.checked;
            Alpine.store('features').list.forEach(function(f) {
                if (f.GroupName == g.Name) { f.hidden = s; }
            })
        },
    }
}
function removeFeature(f) {
    source.removeFeature(f)
    // var list = document.getElementById('featuresList').__x.$data.features;
    var list = Alpine.store('features').list;
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
    if (f.Type == 'LineString') { f.Type = 'Line'; }
    switch (f.Type) {
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
function selectFeature(f) { var sf = select.getFeatures(); sf.clear(); sf.push(f);
    selected.clear(); selected.push(f); selectFeatures(); }

function remoteUpdate(f, to) {
    if (to && to < 0 && (!f.Permissions || f.Permissions == 0)) { return; }
    to = to || f.Permissions
    var w = new ol.format.Polyline();
    // var body = { Name: f.Name, Type: f.type, Polyline: w.writeFeature(f, dp),
        // ID: f.ID, Permissions: f.Permissions };
    var body = f;
    body.Polyline = w.writeFeature(f, dp);
    fetch('/data/pois', { method: to == 0 ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(r => r.text().then(id => {
            if (r.status == 200) { f.ID = id; selectFeatures();
                if (!f.OwnerName) { f.OwnerName = Alpine.store('logged').user; }
                if (to == 0) { f.OwnerName = ""; }
            } else { window.alert("Object without name can't be saved."); } }));
}

function setupEdit() {
    return {
        iconFilter: '',
        groups: false,
        current: {},
        icons: false,
        selected: [],
        arrows: {},
        unit: {}, mag: '1',
        units: [ { u: 'm', v: 1 }, { u: 'km', v: 1000 } ],
        arrowIcons: { l: 'caret-left', r: 'caret-right', u: 'caret-up', d: 'caret-down' },
        setGroup(f, e) { var g = e.target.value; window.g = g;
            if (g == "None") { f.GroupName = ""; } else { f.GroupName = g; } },
        groupsButton(f) {
            if (f.GroupName) { f.GroupName = null; this.groups = false; }
            else { this.groups = !this.groups; }
        },
        groupClass(f) {
            var icon = f.GroupName ? 'folder-x' : 'folder';
            var active = f.GroupName ? ' tool-active' : '';
            return 'grp ti ti-' + icon + active;
        },
        showIcon(ico) { var f = this.iconFilter;
            if (!f && !f.length) { return true; }
            return fuzzy(ico, this.iconFilter);
        },
        className(tool, cat, f, what, pos) {
            var curr = (f || this)[cat || 'current' ];
            if (!curr && cat && this[cat + 's']) {
                curr = this[cat + 's'][0]; if (what) { curr = curr[what]; } }
            var cmp = what ? tool[what] : tool;
            if (pos) {
                var s = Math.abs(curr).toString()
                var n = Math.log10(pos[what]);
                curr = s[s.length - n - 1] || 0;
            }
            var active = curr == cmp ? 'tool-active ' : '';
            if (tool.active && tool.active(f)) { active = 'tool-active '; }
            return active + (tool.icon ? 'ti ti-' + tool.icon : '') },
        setSave(g, p, f) {
            var s = Math.abs(f.Permissions || 0).toString().split('').reverse();
            var n = Math.log10(g.value);
            s[n] = s[n] == p.value ? 0 : p.value;
            for (var i = n - 1; i >= 0; i--) { s[i] = s[i] || 0; }
            f.Permissions = s.reverse().join('') * 1;
            // console.log(s, f.Permissions, n, g.value, p.value);
            remoteUpdate(f); },
        save: {},
        perms: [
            { tooltip: 'Me', value: 1, icon: 'user' },
            { tooltip: 'Faction', value: 10, icon: 'users' },
            { tooltip: 'Area owner', value: 100, icon: 'shield' },
            { tooltip: 'Everyone', value: 10000, icon: 'affiliate' }
        ],
        saves: [
            { tooltip: 'View', value: 1, icon: 'eye' },
            { tooltip: 'Edit', value: 2, icon: 'pencil' },
            { tooltip: 'Delete', value: 4, icon: 'trash' },
        ],
        tools: [
            { value: 'Center view', icon: 'focus-2', action(t,f,e) { centerView(f) } },
            { value: 'Rename', icon: 'edit', action(t,f,e) { rename(f) } },
            { value: 'Set on top', icon: 'arrow-top-bar',
                action(t,f,e) { f.ZIndex = f.ZIndex > 0 ? 0 : 40; redraw(); },
                active(f) { return f.ZIndex && f.ZIndex == 40; }
            },
            { value: 'Toggle hidden', icon: 'eye-off',
                action(t,f,e) { f.Hidden = !f.Hidden; redraw(); },
                active(f) { return f.Hidden }
            },
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

// function init() { console.log(Spruce.store("features").length) }
function updateFeature(f,e) {
    if (e && f[e.target.name]) { f[e.target.name] = e.target.value; }
    var geo = f.getGeometry(); var styleTrg; var style = f.style;
    if (!style) { style = defstyle.clone(); }
    f.coords.forEach(function(c) {
        c[0] = roundPlaces(c[0], 6);
        c[1] = roundPlaces(c[1], 6); })
    switch (f.Type) {
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
    remoteUpdate(f, -1);
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
    ol.coordinate.add(f.coords[n], ol.proj.toLonLat(d));
    updateFeature(f);
}
function forceUpdate() {
    var sel = Alpine.store('selected'); var e = { units: {}, empty: true }; sel.push(e); sel.splice(sel.indexOf(e), 1);
}

function niceOwner(f) {
    var logged = Alpine.store('logged')
    var own = (f.Owner ? f.Owner.Username : '') || f.OwnerName;
    if (!own) { return 'Added by: You (local)'; }
    var str = '"' + own + '"'
    if (f.Owner && f.Owner.Faction && f.Owner.Faction.length) { str += ' from ' + f.Owner.Faction.join(', '); }
    if (logged.user == own) { str = 'You (' + str + ')'; }
    return 'Added by: ' + str;
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

function loginAs(u) {
    var logged = Alpine.store('logged');
    logged.admin = false;
    logged.user = u;
    if (u.length) {
        logged.status = 'Logged as ' + u + '.';
        fetch('/admin/user').then(r => r.text().then(au => {
            if (r.status == 200 && u == au) { logged.admin = true; }
        }));
        // init(true);
    } else { logged.status = ''; }
}

function fetchPost(url, data) {
    var fd = new FormData(); for (k in data) { fd.append(k, data[k]); }
    return fetch(url, { method: 'POST', body: fd }); }

function setupUsers() {
    return {
        users: { List: [], Factions: [] },
        defUsers: { List: [], Factions: [] },
        user: {},
        mode: [],
        modeIcon: { factions: 'building' },
        modes: [ 'users', 'factions' ],
        tool: {},
        refresh() { fetch('/admin/users').then(r => r.json()
            .then(u => { if (r.status == 403) {
                Alpine.store('logged').admin = false; this.users = defUsers; return; }
                this.users = u; })); },
        icon(t, u) {
            var act = t == this.tool; if (t.active) { act = t.active(u, this, t); }
            return 'ti ti-' + t.icon + (act ? ' active' : '');
        },
        action(t,u) { if (t.action) { t.action(u, this, t); } },
        faction(f,u) {},
        userTools: [
            { icon: 'building', active(u, set) { return set.user == u }, tooltip: 'Faction',
                action(u, set) { set.user = u; set.mode = 'factions'; } },
            { icon: 'user-check', active(u) { return u.Confirmed }, tooltip: 'Confirmed',
                action(u, set) { fetchPost('/admin/confirm', { user: u.Username })
                        .then(_ => { set.refresh(); }); } },
            { icon: 'chevrons-up', active(u) { return u.Admin }, tooltip: 'Admin',
                action(u, set) { fetchPost('/admin/admin', { user: u.Username })
                        .then(_ => { set.refresh(); }); } },
        ],
        factionTools: [
        ],
    }
}

function sidebarButton(e) {
    var btn = document.getElementById('toggle-sidebar');
    if (btn) { hide(btn, e); }
}
sidebarButton(true);

document.addEventListener('alpine:init', (f,d) => {
    Alpine.store('selected', []);
    Alpine.store('sidebar', { open: true });
    Alpine.store('logged', {  status: '', user: '', admin: false });
    Alpine.store('features', { list: [], groups: [], tree: {}, flat: [] });
    Alpine.store('geolocation', { state: false, error: '', coords: [ '', '' ] });
    // Alpine.store('mode') = 'Draw';
    window.Alpine = Alpine;
    init(f,d);
})

function init(skip, dispatch) {
    if (!skip) {
        fetch('/user').then(r => r.text()).then(u => loginAs(u)); }
    source.forEachFeature(function(f) { removeFeature(f); });
    fetch('/pois').then(r => r.json()).then(data => {
        data.List.forEach(function(f) { importPoly(f.Polyline, f); });
        var ft = Alpine.store('features'); ft.groups = data.Groups;
        var maxd = -1;
        ft.groupMap = {}; ft.tree = {}; data.Groups.forEach(function(g) {
            if (!ft.tree[g.Depth]) { ft.tree[g.Depth] = []; }
            ft.tree[g.Depth].push(g); ft.groupMap[g.ID] = g;
            if (g.Depth > maxd) { maxd = g.Depth; }
        });
        ft.tree.maxDepth = maxd; ft.flat = [];
        for (var i = 0; i <= maxd; i++) {
            ft.tree[i].sort((a, b) => b.Name.localeCompare(a.Name));
            ft.tree[i].forEach(function(g) {
                var parentGroup = ft.groupMap[g.ParentID];
                if (parentGroup) {
                    var n = ft.flat.indexOf(parentGroup);
                    if (n >= 0) { ft.flat.splice(n + 1, 0, g); return; }
                }
                if (g.Depth > 0) { console.log('No parent: ', g.Name); }
                ft.flat.push(g);
            });
        }
    });
    fetch('/static/iconfont-unicode.json').then(r => r.json()).then(data => {
        var i = []; for (k in data) { i.push(k); } window.icons = i.sort(); });
    if (dispatch) { dispatch('mode', 'Draw'); }
}

function getAllPOIs(imp) {
    fetch('/admin/pois').then(r => r.json()).then(data => {
        all = data.List; groups = data.Groups; if (imp) {
            data.List.forEach(function(f) { importPoly(f.Polyline, f); }); }
    });
}

function rename(f) {
    f.Name = prompt("New name", f.Name || '') || f.Name;
    if (f.Permissions > 0) { remoteUpdate(f); }
    selectFeatures(); }

function toggleGeolocation() {
    var g = Alpine.store('geolocation');
    g.state = !g.state;
    geolocation.setTracking(g.state);
}
function fuzzy(hay, s) {
    hay = hay.toLowerCase()
    var i = 0, n = -1, l;
    s = s.toLowerCase();
    for (; l = s[i++] ;) if (!~(n = hay.indexOf(l, n + 1))) { return false; }
    return true;
};
