export const sendInvoiceReminder=async({
clientName,clientEmail,invoiceNumber,amount,status,
companyName,companyEmail,companyPhone,paymentMethods,invoiceLink
})=>{
try{
const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
service_id:'service_5hait3m',
template_id:'2p8srej',
user_id:'_x4olwB-Hfyx9iXkl',
template_params:{
client_name:clientName,
to_email:clientEmail,
invoice_number:invoiceNumber,
amount:Number(amount).toLocaleString(),
status:status||'pending',
company_name:companyName||'',
company_email:companyEmail||'',
company_phone:companyPhone||'',
payment_methods:paymentMethods||'',
invoice_link:invoiceLink||'',
email:companyEmail||'',
name:companyName||'',
}
})
})
if(response.ok)return{success:true}
return{success:false,error:'Failed to send'}
}catch(e){
console.error(e)
return{success:false,error:e.message}
}
}
