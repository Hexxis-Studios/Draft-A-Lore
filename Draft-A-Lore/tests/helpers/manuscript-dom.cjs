const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
// XML fixtures exercise saved markup; actual browser tests cover contenteditable.
function holder(html='',tag='div'){
  const root=new DOMParser().parseFromString('<'+tag+'/>','text/xml').documentElement;
  const serializer=new XMLSerializer();
  function decorate(node){
    node.querySelectorAll=selector=>{
      const match=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector),className=/^\.([\w-]+)$/.exec(selector),found=[];
      function walk(parent){for(let child=parent.firstChild;child;child=child.nextSibling){if(child.nodeType!==1)continue;
        if((match&&child.hasAttribute(match[1])&&(match[2]===undefined||child.getAttribute(match[1])===match[2]))||(className&&(child.getAttribute('class')||'').split(/\s+/).includes(className[1]))||selector.split(',').includes(child.tagName.toLowerCase()))found.push(decorate(child));
        walk(child);
      }}
      walk(node);return found;
    };
    node.querySelector=selector=>node.querySelectorAll(selector)[0]||null;
    node.remove=()=>node.parentNode&&node.parentNode.removeChild(node);
    const style={};Object.defineProperty(style,'backgroundColor',{get:()=>((node.getAttribute('style')||'').match(/background-color:\s*([^;]+)/)||[])[1]||'',set:value=>node.setAttribute('style','background-color: '+value+';')});node.style=style;
    return node;
  }
  decorate(root);
  Object.defineProperty(root,'innerHTML',{get:()=>Array.from(root.childNodes).map(n=>serializer.serializeToString(n)).join(''),set:value=>{
    while(root.firstChild)root.removeChild(root.firstChild);
    const parsed=new DOMParser().parseFromString('<div>'+value+'</div>','text/xml').documentElement;
    while(parsed.firstChild)root.appendChild(parsed.firstChild);
  }});
  root.innerHTML=html;return root;
}
module.exports={holder};
