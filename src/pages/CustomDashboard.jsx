import{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,setDoc,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{
DndContext,closestCenter,PointerSensor,useSensor,useSensors,DragOverlay
}from'@dnd-kit/core'
import{
SortableContext,rectSortingStrategy,useSortable,arrayMove
}from'@dnd-kit/sortable'
import{CSS}from'@dnd-kit/utilities'
import{
LineChart,Line,BarChart,Bar,AreaChart,Area,PieChart,Pie,Cell,
XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer
}from'recharts'
import{Plus,X,Settings,Save,GripVertical,Download,Palette,Eye,RefreshCcw}from'lucide-react'
import html2canvas from'html2canvas'
import jsPDF from'jspdf'

const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CHART_TYPES=[
{value:'line',label:'Line Chart'},
{value:'bar',label:'Bar Chart'},
{value:'area',label:'Area Chart'},
{value:'pie',label:'Pie Chart'},
{value:'donut',label:'Donut Chart'},
{value:'card',label:'Metric Card'},
]

const DATA_SOURCES=[
{value:'revenue_expense_monthly',label:'Revenue vs Expense (Monthly)',fields:['revenue','expense']},
{value:'revenue_monthly',label:'Revenue by Month',fields:['revenue']},
{value:'expense_monthly',label:'Expense by Month',fields:['expense']},
{value:'invoice_status',label:'Invoice Status Breakdown',fields:['count']},
{value:'top_clients',label:'Top Clients by Revenue',fields:['amount']},
{value:'bank_balances',label:'Bank Account Balances',fields:['balance']},
{value:'profit_monthly',label:'Net Profit by Month',fields:['profit']},
{value:'metric_revenue',label:'Total Revenue (Card)',fields:['value']},
{value:'metric_expense',label:'Total Expense (Card)',fields:['value']},
{value:'metric_profit',label:'Net Profit (Card)',fields:['value']},
{value:'metric_receivable',label:'Total Receivable (Card)',fields:['value']},
{value:'metric_customers',label:'Customer Count (Card)',fields:['value']},
{value:'metric_invoices',label:'Invoice Count (Card)',fields:['value']},
]

const COL_OPTIONS=[
{value:2,label:'2 cols (1/6)'},
{value:3,label:'3 cols (1/4)'},
{value:4,label:'4 cols (1/3)'},
{value:6,label:'6 cols (1/2)'},
{value:8,label:'8 cols (2/3)'},
{value:12,label:'12 cols (Full)'},
]

const COLORS=['#4F6EF7','#16a34a','#dc2626','#d97706','#8b5cf6','#06b6d4','#f59e0b','#10b981','#ec4899','#f97316']

const GRADIENTS=[
{label:'Blue',from:'#4F6EF7',to:'#7C3AED'},
{label:'Green',from:'#16a34a',to:'#059669'},
{label:'Red',from:'#dc2626',to:'#9f1239'},
{label:'Orange',from:'#d97706',to:'#b45309'},
{label:'Purple',from:'#8b5cf6',to:'#6d28d9'},
{label:'Cyan',from:'#06b6d4',to:'#0284c7'},
{label:'Dark',from:'#1a1d2e',to:'#2d3260'},
]

const fmtK=v=>v>=1000000?`${(v/1000000).toFixed(1)}M`:v>=1000?`${(v/1000).toFixed(0)}K`:Number(v||0).toLocaleString()

function getChartData(source,{invoices,expenses,customers,bankAccounts},year){
const getInvDate=inv=>inv.date||(inv.createdAt?.seconds?new Date(inv.createdAt.seconds*1000).toISOString().split('T')[0]:null)
const yr=year||new Date().getFullYear().toString()

if(source==='revenue_expense_monthly'||source==='revenue_monthly'||source==='expense_monthly'||source==='profit_monthly'){
return months.map((m,idx)=>{
const mInv=invoices.filter(i=>getInvDate(i)?.startsWith(`${yr}-${m}`))
const rev=mInv.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const exp=expenses.filter(e=>e.date?.startsWith(`${yr}-${m}`)).reduce((s,e)=>s+Number(e.amount||0),0)
return{name:monthNames[idx],revenue:rev,expense:exp,profit:rev-exp}
}).filter(d=>d.revenue>0||d.expense>0||d.profit!==0)
}

if(source==='invoice_status'){
const map={}
invoices.forEach(i=>{map[i.status]=(map[i.status]||0)+1})
return Object.entries(map).map(([name,count])=>({name,count}))
}

if(source==='top_clients'){
const map={}
invoices.filter(i=>i.status==='paid'||i.status==='partial').forEach(i=>{
if(!map[i.clientName])map[i.clientName]=0
map[i.clientName]+=Number(i.paidAmount||i.totalAmount||0)
})
return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,amount])=>({name,amount}))
}

if(source==='bank_balances'){
return bankAccounts.map(a=>({name:a.name,balance:Number(a.currentBalance||a.openingBalance||0),currency:a.currency||'MMK'}))
}

return[]
}

function getMetricValue(source,{invoices,expenses,customers,bankAccounts},year){
const getInvDate=inv=>inv.date||(inv.createdAt?.seconds?new Date(inv.createdAt.seconds*1000).toISOString().split('T')[0]:null)
const yr=year||new Date().getFullYear().toString()
const yearInv=invoices.filter(i=>getInvDate(i)?.startsWith(yr))
const yearExp=expenses.filter(e=>e.date?.startsWith(yr))
const revenue=yearInv.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const expense=yearExp.reduce((s,e)=>s+Number(e.amount||0),0)

if(source==='metric_revenue')return{value:revenue,label:'Total Revenue',suffix:'Ks'}
if(source==='metric_expense')return{value:expense,label:'Total Expense',suffix:'Ks'}
if(source==='metric_profit')return{value:revenue-expense,label:'Net Profit',suffix:'Ks'}
if(source==='metric_receivable'){
const v=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)
return{value:v,label:'Receivable',suffix:'Ks'}
}
if(source==='metric_customers')return{value:customers.length,label:'Customers',suffix:''}
if(source==='metric_invoices')return{value:invoices.length,label:'Invoices',suffix:''}
return{value:0,label:'',suffix:''}
}

function WidgetRenderer({widget,data}){
const isMetric=widget.dataSource?.startsWith('metric_')
const chartData=isMetric?[]:getChartData(widget.dataSource,data,widget.year)
const metric=isMetric?getMetricValue(widget.dataSource,data,widget.year):null
const colors=widget.chartColors||COLORS
const gradFrom=widget.gradFrom||'#4F6EF7'
const gradTo=widget.gradTo||'#7C3AED'
const chartH=widget.cols>=8?220:widget.cols>=6?180:150

if(isMetric||widget.chartType==='card'){
const isNegative=metric?.value<0
return(
<div style={{
padding:'20px 24px',
background:`linear-gradient(135deg,${gradFrom},${gradTo})`,
borderRadius:12,height:'100%',
display:'flex',flexDirection:'column',justifyContent:'space-between',
minHeight:100,
}}>
<div style={{fontSize:12,opacity:0.8,color:'white',textTransform:'uppercase',letterSpacing:'0.05em'}}>{metric?.label||widget.title}</div>
<div>
<div style={{fontSize:widget.fontSize||28,fontWeight:700,color:'white',lineHeight:1.1}}>
{fmtK(metric?.value||0)}
{metric?.suffix&&<span style={{fontSize:14,marginLeft:4,opacity:0.8}}>{metric.suffix}</span>}
</div>
{widget.year&&<div style={{fontSize:11,opacity:0.6,color:'white',marginTop:4}}>{widget.year}</div>}
</div>
</div>
)
}

const dataKeys=DATA_SOURCES.find(d=>d.value===widget.dataSource)?.fields||['value']

const renderChart=()=>{
if(widget.chartType==='line')return(
<ResponsiveContainer width="100%" height={chartH}>
<LineChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
<XAxis dataKey="name" tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false}/>
<YAxis tickFormatter={fmtK} tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false} width={38}/>
<Tooltip formatter={(v,n)=>[`${fmtK(v)} Ks`,n]} contentStyle={{fontSize:11,borderRadius:8,border:'0.5px solid #e2e8f0'}}/>
<Legend wrapperStyle={{fontSize:10}}/>
{dataKeys.map((k,i)=><Line key={k} type="monotone" dataKey={k} stroke={colors[i]||COLORS[i]} strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}}/>)}
</LineChart>
</ResponsiveContainer>
)

if(widget.chartType==='area')return(
<ResponsiveContainer width="100%" height={chartH}>
<AreaChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
<defs>
{dataKeys.map((k,i)=>(
<linearGradient key={k} id={`grad_${widget.id}_${i}`} x1="0" y1="0" x2="0" y2="1">
<stop offset="5%" stopColor={colors[i]||COLORS[i]} stopOpacity={0.3}/>
<stop offset="95%" stopColor={colors[i]||COLORS[i]} stopOpacity={0}/>
</linearGradient>
))}
</defs>
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
<XAxis dataKey="name" tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false}/>
<YAxis tickFormatter={fmtK} tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false} width={38}/>
<Tooltip formatter={(v,n)=>[`${fmtK(v)} Ks`,n]} contentStyle={{fontSize:11,borderRadius:8,border:'0.5px solid #e2e8f0'}}/>
<Legend wrapperStyle={{fontSize:10}}/>
{dataKeys.map((k,i)=>(
<Area key={k} type="monotone" dataKey={k} stroke={colors[i]||COLORS[i]} strokeWidth={2} fill={`url(#grad_${widget.id}_${i})`}/>
))}
</AreaChart>
</ResponsiveContainer>
)

if(widget.chartType==='bar')return(
<ResponsiveContainer width="100%" height={chartH}>
<BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
<XAxis dataKey="name" tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false}/>
<YAxis tickFormatter={fmtK} tick={{fontSize:9,fill:'#9aa0b4'}} axisLine={false} tickLine={false} width={38}/>
<Tooltip formatter={(v,n)=>[`${fmtK(v)} Ks`,n]} contentStyle={{fontSize:11,borderRadius:8,border:'0.5px solid #e2e8f0'}}/>
<Legend wrapperStyle={{fontSize:10}}/>
{dataKeys.map((k,i)=><Bar key={k} dataKey={k} fill={colors[i]||COLORS[i]} radius={[4,4,0,0]}/>)}
</BarChart>
</ResponsiveContainer>
)

if(widget.chartType==='pie'||widget.chartType==='donut'){
const pieKey=dataKeys[0]||'value'
return(
<ResponsiveContainer width="100%" height={chartH}>
<PieChart>
<Pie
data={chartData}
dataKey={pieKey}
nameKey="name"
cx="50%"cy="50%"
innerRadius={widget.chartType==='donut'?chartH*0.2:0}
outerRadius={chartH*0.38}
label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
labelLine={false}
>
{chartData.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}
</Pie>
<Tooltip formatter={(v)=>[`${fmtK(v)} Ks`]} contentStyle={{fontSize:11,borderRadius:8}}/>
<Legend wrapperStyle={{fontSize:10}}/>
</PieChart>
</ResponsiveContainer>
)
}
return null
}

return(
<div style={{padding:'12px 16px 8px'}}>
{renderChart()}
</div>
)
}

function SortableWidget({widget,data,isEditing,onRemove,onEdit}){
const{attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:widget.id})
const style={transform:CSS.Transform.toString(transform),transition,opacity:isDragging?0.3:1}
const isMetric=widget.dataSource?.startsWith('metric_')
const gradFrom=widget.gradFrom||'#4F6EF7'
const gradTo=widget.gradTo||'#7C3AED'

return(
<div ref={setNodeRef} style={{...style,gridColumn:`span ${widget.cols||4}`}}>
<div style={{
background:isMetric?`linear-gradient(135deg,${gradFrom},${gradTo})`:'white',
borderRadius:14,
boxShadow:'0 2px 16px rgba(0,0,0,0.07)',
border:isMetric?'none':'0.5px solid var(--border)',
overflow:'hidden',height:'100%',
}}>
{/* Header */}
<div style={{
padding:'10px 14px',
display:'flex',alignItems:'center',justifyContent:'space-between',
borderBottom:isMetric?'none':'0.5px solid #f1f5f9',
background:isMetric?'transparent':'rgba(79,110,247,0.02)',
}}>
<div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
{isEditing&&(
<div {...listeners} {...attributes} style={{cursor:'grab',color:isMetric?'rgba(255,255,255,0.6)':'var(--text-3)',flexShrink:0,touchAction:'none'}}>
<GripVertical size={14}/>
</div>
)}
<span style={{
fontSize:widget.titleSize||12,
fontWeight:600,
color:isMetric?'rgba(255,255,255,0.9)':'var(--text-2)',
overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
}}>{widget.title}</span>
</div>
{isEditing&&(
<div style={{display:'flex',gap:4,flexShrink:0}}>
<button type="button" onClick={()=>onEdit(widget)} style={{background:isMetric?'rgba(255,255,255,0.15)':'rgba(79,110,247,0.08)',border:'none',cursor:'pointer',color:isMetric?'white':'var(--primary)',padding:'3px 6px',borderRadius:6,fontSize:10}}>
<Settings size={11}/>
</button>
<button type="button" onClick={()=>onRemove(widget.id)} style={{background:'rgba(220,38,38,0.1)',border:'none',cursor:'pointer',color:'#dc2626',padding:'3px 6px',borderRadius:6}}>
<X size={11}/>
</button>
</div>
)}
</div>
<WidgetRenderer widget={widget} data={data}/>
</div>
</div>
)
}

function AddWidgetModal({onAdd,onClose}){
const[step,setStep]=useState(1)
const[form,setForm]=useState({
chartType:'bar',
dataSource:'revenue_expense_monthly',
title:'',
cols:6,
year:new Date().getFullYear().toString(),
fontSize:28,
titleSize:12,
chartColors:[...COLORS],
gradFrom:'#4F6EF7',
gradTo:'#7C3AED',
})

const selectedDS=DATA_SOURCES.find(d=>d.value===form.dataSource)
const isMetric=form.dataSource?.startsWith('metric_')

const handleAdd=()=>{
const title=form.title||selectedDS?.label||'Widget'
onAdd({
...form,
id:Date.now().toString(),
title,
})
}

return(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:20,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
<div style={{fontWeight:700,fontSize:15}}>Add Widget</div>
<button type="button" onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>

<div style={{padding:24,display:'grid',gap:16}}>

{/* Data Source */}
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Data Source</label>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
{DATA_SOURCES.map(ds=>(
<button key={ds.value} type="button" onClick={()=>setForm(f=>({...f,dataSource:ds.value,chartType:ds.value.startsWith('metric_')?'card':f.chartType}))} style={{
padding:'8px 10px',borderRadius:8,border:`1.5px solid ${form.dataSource===ds.value?'var(--primary)':'#e2e8f0'}`,
background:form.dataSource===ds.value?'rgba(79,110,247,0.06)':'white',
cursor:'pointer',textAlign:'left',fontSize:11,fontWeight:500,
color:form.dataSource===ds.value?'var(--primary)':'var(--text-2)',
}}>
{ds.label}
</button>
))}
</div>
</div>

{/* Chart Type — only if not metric */}
{!isMetric&&(
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Chart Type</label>
<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
{CHART_TYPES.filter(c=>c.value!=='card').map(c=>(
<button key={c.value} type="button" onClick={()=>setForm(f=>({...f,chartType:c.value}))} style={{
padding:'6px 14px',borderRadius:20,border:`1.5px solid ${form.chartType===c.value?'var(--primary)':'#e2e8f0'}`,
background:form.chartType===c.value?'var(--primary)':'white',
color:form.chartType===c.value?'white':'var(--text-2)',
cursor:'pointer',fontSize:12,fontWeight:500,
}}>
{c.label}
</button>
))}
</div>
</div>
)}

{/* Title */}
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Title</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder={selectedDS?.label||'Widget title'} style={{fontSize:13}}/>
</div>

{/* Size & Year */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Width (12 col grid)</label>
<select className="form-input" value={form.cols} onChange={e=>setForm(f=>({...f,cols:Number(e.target.value)}))} style={{fontSize:12}}>
{COL_OPTIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
</select>
</div>
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Year</label>
<input className="form-input" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} placeholder="2026" style={{fontSize:13}}/>
</div>
</div>

{/* Colors */}
{isMetric?(
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Card Gradient</label>
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
{GRADIENTS.map(g=>(
<button key={g.label} type="button" onClick={()=>setForm(f=>({...f,gradFrom:g.from,gradTo:g.to}))} style={{
width:36,height:36,borderRadius:8,
background:`linear-gradient(135deg,${g.from},${g.to})`,
border:form.gradFrom===g.from?'2px solid #1a1d2e':'2px solid transparent',
cursor:'pointer',
}}/>
))}
</div>
</div>
):(
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Chart Colors</label>
<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
{COLORS.map((c,i)=>(
<button key={c} type="button" onClick={()=>{
const nc=[...form.chartColors]
nc[0]=c
setForm(f=>({...f,chartColors:nc}))
}} style={{width:24,height:24,borderRadius:'50%',background:c,border:form.chartColors[0]===c?'2px solid #1a1d2e':'2px solid transparent',cursor:'pointer'}}/>
))}
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
<div>
<div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>Color 1</div>
<input type="color" value={form.chartColors[0]||'#4F6EF7'} onChange={e=>{const nc=[...form.chartColors];nc[0]=e.target.value;setForm(f=>({...f,chartColors:nc}))}} style={{width:'100%',height:28,borderRadius:6,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
<div>
<div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>Color 2</div>
<input type="color" value={form.chartColors[1]||'#ef4444'} onChange={e=>{const nc=[...form.chartColors];nc[1]=e.target.value;setForm(f=>({...f,chartColors:nc}))}} style={{width:'100%',height:28,borderRadius:6,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
</div>
</div>
)}

{/* Preview */}
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Preview</label>
<div style={{
background:isMetric?`linear-gradient(135deg,${form.gradFrom},${form.gradTo})`:'#f8fafc',
borderRadius:12,padding:16,minHeight:60,border:'0.5px solid #e2e8f0',
}}>
{isMetric?(
<div>
<div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginBottom:4}}>{form.title||selectedDS?.label}</div>
<div style={{fontSize:24,fontWeight:700,color:'white'}}>0 Ks</div>
</div>
):(
<div style={{fontSize:12,color:'var(--text-3)',textAlign:'center',padding:8}}>
{form.chartType} chart • {selectedDS?.label} • {form.cols} cols
</div>
)}
</div>
</div>

<div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
<button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleAdd} className="btn btn-primary"><Plus size={14}/>Add Widget</button>
</div>
</div>
</div>
</div>
)
}

function EditWidgetModal({widget,onSave,onClose}){
const[form,setForm]=useState({...widget})
const isMetric=form.dataSource?.startsWith('metric_')

return(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:20,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
<div style={{fontWeight:700,fontSize:15}}>Edit Widget</div>
<button type="button" onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24,display:'grid',gap:14}}>

<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Title</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{fontSize:13}}/>
</div>

<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Width (cols)</label>
<select className="form-input" value={form.cols} onChange={e=>setForm(f=>({...f,cols:Number(e.target.value)}))} style={{fontSize:12}}>
{COL_OPTIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
</select>
</div>
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Year</label>
<input className="form-input" value={form.year||''} onChange={e=>setForm(f=>({...f,year:e.target.value}))} style={{fontSize:13}}/>
</div>
</div>

{!isMetric&&(
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Chart Type</label>
<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
{CHART_TYPES.filter(c=>c.value!=='card').map(c=>(
<button key={c.value} type="button" onClick={()=>setForm(f=>({...f,chartType:c.value}))} style={{
padding:'5px 12px',borderRadius:20,border:`1.5px solid ${form.chartType===c.value?'var(--primary)':'#e2e8f0'}`,
background:form.chartType===c.value?'var(--primary)':'white',
color:form.chartType===c.value?'white':'var(--text-2)',
cursor:'pointer',fontSize:11,fontWeight:500,
}}>
{c.label}
</button>
))}
</div>
</div>
)}

{isMetric?(
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Gradient</label>
<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
{GRADIENTS.map(g=>(
<button key={g.label} type="button" onClick={()=>setForm(f=>({...f,gradFrom:g.from,gradTo:g.to}))} style={{
width:32,height:32,borderRadius:8,
background:`linear-gradient(135deg,${g.from},${g.to})`,
border:form.gradFrom===g.from?'2px solid #1a1d2e':'2px solid transparent',
cursor:'pointer',
}}/>
))}
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
<div>
<div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>From</div>
<input type="color" value={form.gradFrom||'#4F6EF7'} onChange={e=>setForm(f=>({...f,gradFrom:e.target.value}))} style={{width:'100%',height:28,borderRadius:6,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
<div>
<div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>To</div>
<input type="color" value={form.gradTo||'#7C3AED'} onChange={e=>setForm(f=>({...f,gradTo:e.target.value}))} style={{width:'100%',height:28,borderRadius:6,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
</div>
</div>
):(
<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:8}}>Chart Colors</label>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
{[0,1,2].map(i=>(
<div key={i}>
<div style={{fontSize:10,color:'var(--text-3)',marginBottom:3}}>Color {i+1}</div>
<input type="color" value={form.chartColors?.[i]||COLORS[i]} onChange={e=>{
const nc=[...(form.chartColors||COLORS)]
nc[i]=e.target.value
setForm(f=>({...f,chartColors:nc}))
}} style={{width:'100%',height:28,borderRadius:6,border:'0.5px solid var(--border)',cursor:'pointer'}}/>
</div>
))}
</div>
</div>
)}

<div>
<label style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',display:'block',marginBottom:4}}>Font Size</label>
<input className="form-input" type="number" min={10} max={48} value={form.fontSize||28} onChange={e=>setForm(f=>({...f,fontSize:Number(e.target.value)}))} style={{fontSize:13}}/>
</div>

<div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8}}>
<button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={()=>onSave(form)} className="btn btn-primary"><Save size={14}/>Save</button>
</div>
</div>
</div>
</div>
)
}

export default function CustomDashboard(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[customers,setCustomers]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[loading,setLoading]=useState(true)
const[widgets,setWidgets]=useState([])
const[isEditing,setIsEditing]=useState(false)
const[saving,setSaving]=useState(false)
const[showAddModal,setShowAddModal]=useState(false)
const[editingWidget,setEditingWidget]=useState(null)
const[activeId,setActiveId]=useState(null)
const[exporting,setExporting]=useState(false)
const dashboardRef=useRef()

const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}))

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[invSnap,expSnap,custSnap,baSnap,layoutSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
getDocs(collection(db,'companies',cid,'customers')),
getDocs(collection(db,'companies',cid,'bankAccounts')),
getDoc(doc(db,'companies',cid,'_config','customDashboard')),
])
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
setCustomers(custSnap.docs.map(d=>({id:d.id,...d.data()})))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false))
if(layoutSnap.exists()&&layoutSnap.data().widgets?.length){
setWidgets(layoutSnap.data().widgets)
}else{
setWidgets([
{id:'1',chartType:'card',dataSource:'metric_revenue',title:'Total Revenue',cols:3,year:'2026',gradFrom:'#4F6EF7',gradTo:'#7C3AED',fontSize:24},
{id:'2',chartType:'card',dataSource:'metric_expense',title:'Total Expense',cols:3,year:'2026',gradFrom:'#dc2626',gradTo:'#9f1239',fontSize:24},
{id:'3',chartType:'card',dataSource:'metric_profit',title:'Net Profit',cols:3,year:'2026',gradFrom:'#16a34a',gradTo:'#059669',fontSize:24},
{id:'4',chartType:'card',dataSource:'metric_receivable',title:'Receivable',cols:3,year:'2026',gradFrom:'#d97706',gradTo:'#b45309',fontSize:24},
{id:'5',chartType:'area',dataSource:'revenue_expense_monthly',title:'Revenue vs Expense',cols:8,year:'2026',chartColors:['#4F6EF7','#ef4444']},
{id:'6',chartType:'donut',dataSource:'invoice_status',title:'Invoice Status',cols:4,year:'2026',chartColors:[...COLORS]},
{id:'7',chartType:'bar',dataSource:'top_clients',title:'Top Clients',cols:6,year:'2026',chartColors:['#4F6EF7']},
{id:'8',chartType:'line',dataSource:'profit_monthly',title:'Monthly Profit',cols:6,year:'2026',chartColors:['#16a34a']},
])
}
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const handleSave=async()=>{
setSaving(true)
try{
await setDoc(doc(db,'companies',companyId,'_config','customDashboard'),{widgets,updatedAt:new Date().toISOString()})
alert('Dashboard saved ✓')
setIsEditing(false)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleExportPDF=async()=>{
setExporting(true)
try{
const el=dashboardRef.current
const canvas=await html2canvas(el,{scale:1.5,useCORS:true,backgroundColor:'#f8fafc'})
const pdf=new jsPDF('l','mm','a4')
const w=pdf.internal.pageSize.getWidth()
const h=(canvas.height*w)/canvas.width
pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,w,h)
pdf.save(`Dashboard_${new Date().toISOString().split('T')[0]}.pdf`)
}catch(e){alert(e.message)}
setExporting(false)
}

const handleExportPNG=async()=>{
setExporting(true)
try{
const el=dashboardRef.current
const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#f8fafc'})
const a=document.createElement('a')
a.href=canvas.toDataURL('image/png')
a.download=`Dashboard_${new Date().toISOString().split('T')[0]}.png`
a.click()
}catch(e){alert(e.message)}
setExporting(false)
}

const addWidget=(w)=>setWidgets(prev=>[...prev,w])
const removeWidget=(id)=>setWidgets(w=>w.filter(x=>x.id!==id))
const updateWidget=(updated)=>setWidgets(w=>w.map(x=>x.id===updated.id?updated:x))

const handleDragEnd=(e)=>{
const{active,over}=e
setActiveId(null)
if(active.id!==over?.id){
setWidgets(items=>{
const oi=items.findIndex(i=>i.id===active.id)
const ni=items.findIndex(i=>i.id===over.id)
return arrayMove(items,oi,ni)
})
}
}

const data={invoices,expenses,customers,bankAccounts}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="My Dashboard">
{showAddModal&&<AddWidgetModal onAdd={(w)=>{addWidget(w);setShowAddModal(false)}} onClose={()=>setShowAddModal(false)}/>}
{editingWidget&&<EditWidgetModal widget={editingWidget} onSave={(w)=>{updateWidget(w);setEditingWidget(null)}} onClose={()=>setEditingWidget(null)}/>}

{/* Toolbar */}
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,gap:12,flexWrap:'wrap'}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<h2 style={{fontSize:16,fontWeight:700,color:'var(--text-1)'}}>My Dashboard</h2>
<span style={{fontSize:11,color:'var(--text-3)',background:'#f1f5f9',padding:'2px 8px',borderRadius:20}}>{widgets.length} widgets</span>
</div>
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
{!isEditing&&(
<>
<button type="button" onClick={handleExportPNG} disabled={exporting} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={13}/>PNG
</button>
<button type="button" onClick={handleExportPDF} disabled={exporting} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={13}/>PDF
</button>
</>
)}
{isEditing&&(
<button type="button" onClick={()=>setShowAddModal(true)} className="btn btn-ghost" style={{fontSize:12}}>
<Plus size={14}/>Add Widget
</button>
)}
<button type="button" onClick={()=>isEditing?handleSave():setIsEditing(true)} disabled={saving} className="btn btn-primary" style={{fontSize:12}}>
{isEditing?<><Save size={13}/>{saving?'Saving...':'Save'}</>:<><Settings size={13}/>Edit Layout</>}
</button>
{isEditing&&(
<button type="button" onClick={()=>setIsEditing(false)} className="btn btn-ghost" style={{fontSize:12}}>
<X size={13}/>Cancel
</button>
)}
</div>
</div>

{/* Dashboard Canvas */}
<div ref={dashboardRef}>
{widgets.length===0?(
<div style={{padding:80,textAlign:'center',color:'var(--text-3)',background:'white',borderRadius:14,border:'1px dashed var(--border)'}}>
<Settings size={40} style={{margin:'0 auto 12px',opacity:0.2}}/>
<div style={{fontSize:15,fontWeight:500,marginBottom:8}}>No widgets yet</div>
<button type="button" onClick={()=>{setIsEditing(true);setShowAddModal(true)}} className="btn btn-primary"><Plus size={14}/>Add First Widget</button>
</div>
):(
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e=>setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
<SortableContext items={widgets.map(w=>w.id)} strategy={rectSortingStrategy}>
<div style={{
display:'grid',
gridTemplateColumns:'repeat(12,1fr)',
gap:16,
alignItems:'start',
}}>
{widgets.map(widget=>(
<SortableWidget
key={widget.id}
widget={widget}
data={data}
isEditing={isEditing}
onRemove={removeWidget}
onEdit={setEditingWidget}
/>
))}
</div>
</SortableContext>
<DragOverlay>
{activeId?(
<div style={{background:'white',borderRadius:14,padding:20,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',opacity:0.9}}>
<span style={{fontSize:13,fontWeight:600,color:'var(--primary)'}}>{widgets.find(w=>w.id===activeId)?.title}</span>
</div>
):null}
</DragOverlay>
</DndContext>
)}
</div>

</Layout>
)
}
