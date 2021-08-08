const express = require("express")
const axios = require("axios").default
const querystring = require("querystring")
const config = require("./config")
const fs = require("fs")
const bodyParser = require('body-parser').json();

const port = 3000

const app = express()

app.use(bodyParser)

//there are two endpoints accessible by users in this aplication
//first endpoint(/login) will be used to authorize the user
//second endpoint(/sendemail) will be used to send email by authorized user

// this function returns the Google's OAuth 2.0 endpoint with required parameters as a string
function getauthurl(){
    var parameters = {  
        client_id : config.client_id ,
        redirect_uri : config.host,
        response_type : "code" ,
        scope : "https://mail.google.com/" ,
        access_type : "offline"
    }
    const base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    var query_parameters = querystring.stringify(parameters)
    const auth_url = `${base_url}?${query_parameters}`
    return auth_url

}

//this function makes a call to google endpoint with authorization code as query parameter and returns access_token and refresh_token
function gettokens(code){
    var parameters = {
        client_id : config.client_id ,
        client_secret : config.client_secret ,
        code : code ,
        grant_type : "authorization_code" ,
        redirect_uri : config.host
    }
    const base_url = "https://oauth2.googleapis.com/token"
    var query_parameters = querystring.stringify(parameters)
    const token_url = `${base_url}?${query_parameters}`
    return axios.post(token_url)
   

    

}

// call this endpoint to initaite the oauth process, It will authenticate the user and obtain their consent to access requested scopes
// then user will be redirected to the redirect_url provided as a query parameter
app.get("/login" , (req , res) => {
    try{
        res.redirect(getauthurl())
    }catch(err){
        throw new Error(err)
    }
    
})

//this is the endpoint where the user will be redirected to after authentication with authorization code as a query parameter
//auth code will then be saved in a file for calling gmail api
app.get("/" ,async (req , res) => {
    var auth_code = req.query.code
    await gettokens(auth_code)
    .then((response) => {
        if(response.data.access_token){
            fs.writeFile("token.txt" , response.data.access_token , function (err) {
                if (err) throw err;
                console.log('Saved!');
              })
            res.statusCode = 200
            res.setHeader("Content_type" , "application/json")
            res.json({"message" : "authentication succsessful"})
         }
        else{
            res.statusCode = 200
            res.setHeader("Content_type" , "application/json")
            res.json({"error message" : response.data.error})
            console.log(res.data.error)}
    })
    .catch((err) => {
        console.log(err)
    })


    
})


//createbody function wil be used to create the body of email and returning a base64 encoded string to send with gmail api request
const createbody = (params) => {
    params.subject = new Buffer.from(params.subject).toString("base64")
    const body = [
        'Content-Type: text/plain; charset="UTF-8"\n',
        "MINE-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        `to: ${params.to} \n`,
        `subject: =?UTF-8?B?${params.subject}?= \n\n`,
        params.message
    ].join('');
    return new Buffer.from(body).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

//sendemail function will be used to send the email 
function sendemail(raw){
    buffer = fs.readFileSync("token.js" , "utf-8" , (err , data) => {
        if(err){
            console.log("access token not found" )
            return}
        console.log("data" ,data)
    })
    var accesstoken = buffer.toString()
    const headerconfig = {
        headers : {
            "Authorization" : `Bearer ${accesstoken}`
        }
    }

    return axios.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send" , {"raw" : `${raw}`} , headerconfig)
}



//sendemail endpoint will be used by the athorized user to send email to desired address
//sendeamil endpoint requires reciever's email address , subject of email and message of email in the request body

app.post("/sendemail" , async (req , res) => {
    var raw = createbody({
        to : req.body.to,
        subject : req.body.subject,
        message : req.body.message
    })
    await sendemail(raw)
    .then((resbody) => {
        if(resbody.data.id){
            res.statusCode = 200
            res.setHeader("Content-Type" , "application/json")
            res.json({"success" : "true", "message" : "email sent successfully"})
        }else{
            res.statusCode = 400
            res.setHeader("Content-Type" , "application/json")
            res.json({"success" : "false", "message" : "unable to sent email"})
        }

    })
    .catch((err) => {
        console.log(err)
    })
    
})



app.listen(port , () => {
    console.log(`express server listening at ${port}`)
})