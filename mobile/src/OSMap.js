// Map = OpenStreetMap data drawn with Leaflet inside a WebView. Needs NO Google API key, so it works in Expo Go.
// Shows: routes (selected one bold), RED highlighted risky stretches, places along the route (P police, H hospital, G petrol, T station, S 24h store, C crowded, F shops), you.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { WebViewMod } from './native';
import { C } from './theme';
import { TYPE_COLOR } from './util';

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css">
<style>html,body,#m{height:100%;margin:0;background:#eef0f3}
.pm{width:22px;height:22px;border-radius:50%;border:2px solid #fff;color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px #0006}
.msg{font:14px sans-serif;padding:16px;color:#555}</style></head>
<body><div id="m"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
var map=null,g=null,lastFit='';
if(window.L){
  map=L.map('m',{zoomControl:true}).setView([20.5,78.9],5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd',attribution:'© OpenStreetMap © CARTO'}).addTo(map);
  g=L.layerGroup().addTo(map);
}else{document.getElementById('m').innerHTML='<p class="msg">Map could not load. Check your internet connection.</p>';}
window.update=function(d){
  if(!map)return;
  g.clearLayers();
  d.routes.forEach(function(r,i){if(i!==d.sel)L.polyline(r.pts,{color:r.color,weight:4,opacity:.35}).addTo(g);});
  var s=d.routes[d.sel],pl=L.polyline(s.pts,{color:s.color,weight:7,opacity:.95}).addTo(g);
  (d.hot||[]).forEach(function(h){L.polyline(h,{color:'#D92D20',weight:10,opacity:.55,lineCap:'round'}).addTo(g);});
  d.pois.forEach(function(p){
    L.marker([p[0],p[1]],{icon:L.divIcon({className:'',html:'<div class="pm" style="background:'+p[3]+'">'+p[2]+'</div>',iconSize:[22,22],iconAnchor:[11,11]})}).bindPopup(p[4]).addTo(g);
  });
  L.circleMarker(s.pts[0],{radius:8,color:'#D92D20',weight:4,fillColor:'#fff',fillOpacity:1}).bindTooltip('Start').addTo(g);
  L.circleMarker(s.pts[s.pts.length-1],{radius:8,color:'#fff',weight:3,fillColor:'#171B22',fillOpacity:1}).bindTooltip('Destination').addTo(g);
  if(d.me)L.circleMarker(d.me,{radius:8,color:'#fff',weight:3,fillColor:'#2B59D9',fillOpacity:1}).bindTooltip('You').addTo(g);
  if(d.fit!==lastFit){lastFit=d.fit;map.fitBounds(pl.getBounds(),{padding:[28,28]});}
};
</script></body></html>`;

export default function OSMap({ routes, sel, me, height = 320 }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const WebView = WebViewMod && WebViewMod.WebView;

  useEffect(() => {
    if (!ready || !ref.current || !routes.length) return;
    const r = routes[sel];
    const data = {
      routes: routes.map((x) => ({ color: x.color, pts: x.pts })), sel, hot: r.hot || [],
      pois: (r.pois || []).map((p) => [p.lat, p.lng, p.t, TYPE_COLOR[p.t] || '#6B7684', (p.n || p.label) + ' (' + p.label + ')']),
      me: me ? [me.latitude, me.longitude] : null,
      fit: routes.length + ':' + sel + ':' + r.min + ':' + r.km,       // re-centre only when the route changes, not on every GPS update
    };
    ref.current.injectJavaScript(`window.update(${JSON.stringify(data)});true;`);
  }, [ready, routes, sel, me]);

  if (!WebView) return <Text style={{ color: C.warn, marginTop: 16 }}>Map module is not available on this phone.</Text>;
  return (
    <View style={{ height, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.line, marginTop: 18 }}>
      <WebView ref={ref} originWhitelist={['*']} source={{ html: HTML, baseUrl: 'https://safepath.app/' }}
        onLoadEnd={() => setReady(true)} javaScriptEnabled domStorageEnabled mixedContentMode="always"
        nestedScrollEnabled overScrollMode="never" style={{ flex: 1, backgroundColor: '#eef0f3' }} />
    </View>
  );
}
