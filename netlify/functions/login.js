const { signToken } = require('./_lib');

exports.handler = async (event)=>{
  if(event.httpMethod!=='POST') return { statusCode:405, body:'Method not allowed' };
  try{
    const { pin } = JSON.parse(event.body||'{}');
    if(!pin || pin !== process.env.TEAM_PIN){
      return { statusCode:401, body:JSON.stringify({error:'invalid'}) };
    }
    const token = signToken(process.env.AUTH_SECRET);
    return { statusCode:200, body:JSON.stringify({token}) };
  }catch(e){
    return { statusCode:500, body:JSON.stringify({error:e.message}) };
  }
};
