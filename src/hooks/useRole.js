import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{getDocs,collection,query,where}from'firebase/firestore'

export function useRole(){
const[role,setRole]=useState(null)
const[companyId,setCompanyId]=useState(null)
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser?.uid}`,'!=',null)))
if(!snap.empty){
const cData=snap.docs[0].data()
setCompanyId(snap.docs[0].id)
setRole(cData.members?.[auth.currentUser.uid]||'staff')
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const canEdit=role==='owner'||role==='admin'
const canDelete=role==='owner'||role==='admin'
const canSettings=role==='owner'
const canReports=role==='owner'||role==='admin'

return{role,companyId,loading,canEdit,canDelete,canSettings,canReports}
}
