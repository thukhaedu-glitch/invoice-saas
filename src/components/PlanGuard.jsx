import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import{useNavigate}from'react-router-dom'
import{usePlans}from'../hooks/usePlans'
import Layout from'./Layout'
import{Lock,Crown}from'lucide-react'

// feature တစ်ခုကို လက်ရှိ plan က သုံးခွင့်ရှိ/မရှိ စစ်ပြီး gate လုပ်တယ်
export default function PlanGuard({feature,children}){
const navigate=useNavigate()
const{canUse,planLabel,loading:plansLoading}=usePlans()
const[plan,setPlan]=useState('free')
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty)setPlan(snap.docs[0].data().plan||'free')
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

if(loading||plansLoading)return<Layout title="Loading"><div style={{padding:40,textAlign:'center'}}>Loading...</div></Layout>

// သုံးခွင့်ရှိရင် content ပြ
if(canUse(plan,feature))return children

// မရှိရင် — upgrade prompt
return(
<Layout title="Upgrade Required">
<div style={{maxWidth:440,margin:'60px auto',textAlign:'center',padding:36,background:'white',borderRadius:16,border:'0.5px solid var(--border)'}}>
<div style={{width:64,height:64,borderRadius:'50%',background:'rgba(139,92,246,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
<Lock size={28} color="#8b5cf6"/>
</div>
<h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Upgrade လိုအပ်ပါတယ်</h2>
<p style={{color:'var(--text-3)',fontSize:14,marginBottom:6}}>ဒီ feature ကို သုံးဖို့ plan upgrade လုပ်ရပါမယ်။</p>
<p style={{color:'var(--text-3)',fontSize:13,marginBottom:24}}>သင့်ရဲ့ လက်ရှိ plan — <strong>{planLabel(plan)}</strong> မှာ မပါဝင်ပါ။</p>
<button onClick={()=>navigate('/upgrade')} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'#8b5cf6',color:'white',fontWeight:600,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
<Crown size={16}/>Upgrade Plan
</button>
<button onClick={()=>navigate(-1)} style={{width:'100%',padding:'10px',marginTop:10,borderRadius:10,border:'0.5px solid var(--border)',background:'white',color:'var(--text-2)',fontWeight:500,fontSize:13,cursor:'pointer'}}>
Back
</button>
</div>
</Layout>
)
}
