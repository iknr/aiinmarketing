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
/* AI Lab: tool picker on desktop, 3D stacking cards on phones */
(function(){
  function init(){
    var lab=document.getElementById('lab'); if(!lab) return;
    var tabs=[].slice.call(lab.querySelectorAll('.lab-tabs button')), pns=[].slice.call(lab.querySelectorAll('.lab-pn'));
    function pick(i,focus){
      tabs.forEach(function(t,k){ var on=k===i; t.classList.toggle('is-on',on); t.setAttribute('aria-selected',on?'true':'false'); t.tabIndex=on?0:-1; });
      pns.forEach(function(p,k){ p.classList.toggle('is-on',k===i); });
      if(focus) tabs[i].focus();
    }
    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){pick(i)});
      t.addEventListener('keydown',function(e){
        var k=e.key; if(k!=='ArrowDown'&&k!=='ArrowUp'&&k!=='ArrowRight'&&k!=='ArrowLeft'&&k!=='Home'&&k!=='End') return;
        e.preventDefault(); var n=k==='Home'?0:k==='End'?tabs.length-1:(i+(k==='ArrowDown'||k==='ArrowRight'?1:-1)+tabs.length)%tabs.length; pick(n,true);
      });
    });
    var mq=matchMedia('(max-width:820px)'), rm=matchMedia('(prefers-reduced-motion: reduce)'), tick=false;
    function clear(){ pns.forEach(function(p){ p.style.transform=''; p.style.filter=''; }); }
    function fx(){
      tick=false;
      if(!mq.matches||rm.matches){ clear(); return; }
      pns.forEach(function(p,i){
        var nx=pns[i+1]; if(!nx){ p.style.transform=''; p.style.filter=''; return; }
        var h=p.offsetHeight||300, stick=parseFloat(getComputedStyle(p).top)||0;
        var d=nx.getBoundingClientRect().top-(stick+14);
        var t=Math.max(0,Math.min(1,1-d/h));
        p.style.transform='perspective(900px) scale('+(1-0.07*t).toFixed(4)+') rotateX('+(-5*t).toFixed(2)+'deg)';
        p.style.filter='brightness('+(1-0.14*t).toFixed(3)+')';
      });
    }
    function req(){ if(!tick){ tick=true; requestAnimationFrame(fx); } }
    window.addEventListener('scroll',req,{passive:true}); window.addEventListener('resize',req);
    if(mq.addEventListener) mq.addEventListener('change',req); fx();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
