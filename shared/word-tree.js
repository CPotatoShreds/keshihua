const PUNCT=/^[，。！？；：、“”‘’（）《》〈〉…—\s]+$/;
const SKIP=new Set(['的','了','在','是','和','也','都','就','不','有','人','这','那','里','上','下','中','对','把','被','让','给','从','到','与','及','而','但','却','还','又','很','更','最','会','能','要','说','看','等','再','只','一','个','些','条','次','点','我','你','他','她','它','我们','他们','大家','自己','这个','那个','如果','因为','所以','但是','而且','以及','可能','应该','可以','需要','已经','目前','还是','就是','没有','不是','不能','不要','出来','出现','带来','忽略','落实','追问','提到','看到','觉得','认为','相关','不少','有人','评论','方面','情况','时候','同样','值得','越来越','一句','一点','一样','仍','才','刚刚','最受','来说','之后','是否','能够','继续','其','并','且','时','才','网友','居民','市民','游客']);
const boundary=token=>!token||PUNCT.test(token);
const skipped=token=>SKIP.has(token);
function addPath(root,sequence,text){
 let node=root;
 for(const token of sequence){
  if(boundary(token))break;
  let child=node.children.get(token);
  if(!child){child={token,count:0,children:new Map(),example:null};node.children.set(token,child);}
  child.count++;
  if(!child.example)child.example=text;
  node=child;
 }
}
function prune(node,{minCount,maxBranches},budget){
 const candidates=[...node.children.values()].filter(c=>c.count>=minCount).sort((a,b)=>b.count-a.count||a.token.localeCompare(b.token)).slice(0,maxBranches),children=[];
 for(const child of candidates){
  if(budget.left<=0)break;
  budget.left--;
  if(!child.example)child.example=node.example;
  children.push(prune(child,{minCount,maxBranches},budget));
 }
 return {token:node.token,count:node.count,example:node.example,children};
}
// Bidirectional word tree: left = immediately preceding tokens (reversed), right = following tokens.
export function buildWordTree(texts,root,{depth=2,minCount=3,maxBranches=5,maxNodes=60}={}){
 if(!root)return {root:'',count:0,left:null,right:null};
 const left={count:0,children:new Map(),example:null},right={count:0,children:new Map(),example:null};
 let count=0;
 for(const text of texts){
  const tokens=text.tokens||[],example=text.text||'';
  for(let i=0;i<tokens.length;i++){
   if(tokens[i]!==root)continue;
   count++;
   if(!left.example)left.example=example;
   if(!right.example)right.example=example;
   const before=[];
   for(let k=1;k<=depth+5&&i-k>=0&&before.length<depth;k++){const token=tokens[i-k];if(boundary(token))break;if(skipped(token))continue;before.push(token);}
   addPath(left,before,example);
   const after=[];
   for(let k=1;k<=depth+5&&i+k<tokens.length&&after.length<depth;k++){const token=tokens[i+k];if(boundary(token))break;if(skipped(token))continue;after.push(token);}
   addPath(right,after,example);
  }
 }
 const half=Math.max(1,Math.floor(maxNodes/2)),options={minCount,maxBranches};
 return {
  root,count,
  left:count?prune({token:root,count,children:left.children,example:left.example},options,{left:half}):null,
  right:count?prune({token:root,count,children:right.children,example:right.example},options,{left:half}):null
 };
}
export function countTreeNodes(tree){return tree?1+tree.children.reduce((n,c)=>n+countTreeNodes(c),0):0;}
