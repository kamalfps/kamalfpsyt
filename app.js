document.documentElement.classList.add("js");
const CFG=Object.assign({YT_HANDLE:"kamalfps"},window.CFG||{}),$=i=>document.getElementById(i);
const E=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const sb=window.supabase&&CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;
const DAYS_LEFT=()=>{const n=new Date();return Math.max(0,Math.round((new Date(2027,0,1)-new Date(n.getFullYear(),n.getMonth(),n.getDate()))/864e5))};
(()=>{const el=$("top");if(!el)return;const cur=location.pathname.split("/").pop()||"index.html";
 el.innerHTML='<a class="logo" href="index.html">KamalFPS</a><span>'+[["index.html","Home"],["titles.html","Titles"],["thumbnails.html","Thumbnails"],["studio.html","Studio"]].map(([h,t])=>`<a href="${h}"${h===cur?' class="on"':""}>${t}</a>`).join("")+"</span>"})();
function countTo(el,to){if(still){el.textContent=to.toLocaleString();return}const t0=performance.now(),f=t=>{const p=Math.min(1,(t-t0)/1500);el.textContent=Math.round(to*(1-Math.pow(1-p,3))).toLocaleString();if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
async function site(k){if(!sb)return null;const r=await sb.from("site").select("value").eq("key",k).maybeSingle();return r.data?r.data.value:null}
let _v=0,_top=[];
async function ytChannel(vids){if(!CFG.YT_API_KEY)throw new Error("Add your YouTube API key in config.js.");
 const B="https://www.googleapis.com/youtube/v3/",K="&key="+CFG.YT_API_KEY;
 const j=await(await fetch(`${B}channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(CFG.YT_HANDLE)}${K}`)).json(),c=j.items&&j.items[0];
 if(!c)throw new Error(j.error?j.error.message+" Make a new API key (see SETUP.md).":"Channel not found.");
 const s=c.statistics;
 if(vids&&Date.now()-_v>6e5){_v=Date.now();const p=await(await fetch(`${B}playlistItems?part=contentDetails&maxResults=15&playlistId=${c.contentDetails.relatedPlaylists.uploads}${K}`)).json(),ids=(p.items||[]).map(i=>i.contentDetails.videoId).join(","),v=ids?await(await fetch(`${B}videos?part=snippet,statistics&id=${ids}${K}`)).json():{items:[]};
  _top=(v.items||[]).sort((a,b)=>b.statistics.viewCount-a.statistics.viewCount).slice(0,5)}
 return{subs:+s.subscriberCount,hidden:s.hiddenSubscriberCount,views:+s.viewCount,vids:+s.videoCount,top:_top}}
if("IntersectionObserver" in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.1});document.querySelectorAll(".rv").forEach(n=>io.observe(n))}
