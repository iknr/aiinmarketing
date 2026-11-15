/* AIM home: phone accordions, track tabs, desktop jump bar. Content stays in the DOM. */
(function(){
  var mq=window.matchMedia('(max-width: 820px)');
  function accordions(){
    var groups=document.querySelectorAll('#tracks .am-grid,#ask .am-grid,#curriculum .amx-tools');
    groups.forEach(function(g){
      var items=g.querySelectorAll(':scope > details.amx-acc');
      items.forEach(function(d,i){ d.open = mq.matches ? i===0 : true; });
    });
  }
  document.addEventListener('click',function(e){
    var s=e.target.closest&&e.target.closest('details.amx-acc > summary');
    if(s && !mq.matches){ e.preventDefault(); }
  });
  function tabs(){
    var g=document.querySelector('[data-aimtabs]'); if(!g||g.__done) return; g.__done=1;
    var cards=[].slice.call(g.querySelectorAll('.amx-trackcard'));
    var bar=document.createElement('div'); bar.className='amx-tabbar'; bar.setAttribute('role','tablist');
    cards.forEach(function(c,i){
      var b=document.createElement('button'); b.type='button'; b.setAttribute('role','tab');
      b.textContent=c.querySelector('.amx-tag').textContent.replace(' track','');
      b.addEventListener('click',function(){ select(i); });
      bar.appendChild(b);
    });
    g.parentNode.insertBefore(bar,g);
    function select(i){
      cards.forEach(function(c,k){ c.classList.toggle('is-on',k===i); });
      [].forEach.call(bar.children,function(b,k){ b.setAttribute('aria-selected',k===i?'true':'false'); });
    }
    select(0);
  }
  function jump(){
    if(document.getElementById('amx-jump')) return;
    var items=[['fees-market','Fee'],['tracks','Curriculum'],['phases','How it runs'],['trainers','Trainers'],['faq','FAQ']];
    var n=document.createElement('nav'); n.id='amx-jump'; n.setAttribute('aria-label','On this page');
    n.innerHTML=items.map(function(x){return '<a href="#'+x[0]+'">'+x[1]+'</a>';}).join('');
    document.body.appendChild(n);
    var hero=document.getElementById('top')||document.querySelector('.am-lp section');
    function on(){ var y=hero?hero.getBoundingClientRect().bottom:300; n.classList.toggle('is-on', y<0); }
    window.addEventListener('scroll',on,{passive:true}); on();
  }
  function init(){ accordions(); tabs(); jump(); }
  if(mq.addEventListener) mq.addEventListener('change',accordions);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
/* reviews: arrow buttons scroll the row by one card */
(function(){
  function init(){
    var l=document.getElementById('rvb-list'); if(!l) return;
    var p=document.querySelector('.rvb-prev'), n=document.querySelector('.rvb-next');
    function step(d){ var c=l.querySelector('.am-rv'); var w=c?c.getBoundingClientRect().width+16:320; l.scrollBy({left:d*w,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); }
    function upd(){ if(!p) return; p.disabled=l.scrollLeft<4; n.disabled=l.scrollLeft+l.clientWidth>=l.scrollWidth-4; }
    if(p) p.addEventListener('click',function(){step(-1)});
    if(n) n.addEventListener('click',function(){step(1)});
    l.addEventListener('scroll',upd,{passive:true}); window.addEventListener('resize',upd); upd();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
