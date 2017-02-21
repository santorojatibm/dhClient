//-----------------------------------------------------------------------------
// Name:       dhClient Service                                   
//                                                                              
// Purpose:    Microservice                                                     
//                                                                              
// Interfaces: MongoDB database                                                 
//                                                                              
// Author:     Sal Carceller                                                    
//                                                                              
//-----------------------------------------------------------------------------
var http         = require('http');
var url          = require('url');
var express      = require('express');
var bodyParser   = require('body-parser');
var request      = require('request');
var mongoClient  = require('mongodb').MongoClient;
var helper       = require('./dhCommon/helpers'); // include helper functions from helpers.js

//-----------------------------------------------------------------------------
// Set up express                                    
var app = express();
var server = http.createServer(app);
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing application/json
//-----------------------------------------------------------------------------

// what host and port should we listen on?
//var _host = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';  // host to listen on
var _port = process.env.OPENSHIFT_NODEJS_PORT || 8080;       // port to listen on

//-----------------------------------------------------------------------------
// return code definitions, used in json responses {"RC": _rcOK}  
var _rcOK      = 0;
var _rcWarning = 1;
var _rcError   = 2;
var _rcUnknown = 99;
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Example dhClient (Customer) json record
//-----------------------------------------------------------------------------
/*
{
  // Auto generated fields, when creating a record do not pass these in 
  "_id": "mongo generated",
  "clientId": "auto generated", 

  // required fields
  "clientName": 
  {
    "clientFN": "Richard",
    "clientLN": "Hendrix"
  },
  "clientInfo": 
  {
    "address": "101 Valley Steet",
    "city": "Glendale",
    "state": "California",
    "zip": "91201",
    "phone": "555-676-8907",
    "email": "jh@music.com"
  },

  // optional fields
  "agentId": 1000,
  "suggestedProperties": 
  [
    {
      "propertyId": 2000,
      "propertyState": 0,
      "askingPrice": 320000,
      "rating": 0,
      "comments": 
      [
        {
          "comment": "This is a beautiful home"
        }
      ]
    }
  ],
  "minAskingPrice": 200000,
  "maxAskingPrice": 400000
}
*/

//-----------------------------------------------------------------------------
// Main code body
//-----------------------------------------------------------------------------
console.log("DreamHome.dhClient service ==> Begin Execution.");

// wait for DB module to fully initialize and connect to the backend DB
// we don't want to start the node.js server listening till we know we are fully connected to the DB
helper.dbInit( function(err)
{
  if(!err)
  { // DB connections have been established. 
    console.log('  ... application has successfully connected to the DB');
  }
  else
  { // OH no! something has gone wrong building DB connections!
    // we still proceed and start the server listening
    // but we mark the server as having a severe DB connection error!
    console.log('  ... WARNING: application failed to connect with the backend DB!');
  }

  // Start the node.js server listening
  // even if the backend DB connection fails we still want to service requests
  app.listen(_port);

  console.log('  ... application now listening on port ' + _port);
});


//-----------------------------------------------------------------------------
// fetch/get a client/customer record by clientId (cid)
//-----------------------------------------------------------------------------
app.get('/client/:cid', function(req, res) 
{
  var retjson = {"RC":_rcOK};       // assume a good json response
  var statusCode = 200;             // assume valid http response code=200 (OK, good response)

  // get the clientId (cid) parm that came in on the request
  // it comes in as a string and MUST be converted to a base10 integer
  var cid = parseInt(req.params.cid, 10);

  var cref = helper.crefClient();   // obtain the dhClient collection handle/refrence
  var dbQuery = {'clientId':cid};   // setup the query for locating the client record by cid

//console.log('  ... dbQuery ('+JSON.stringify(dbQuery)+')');

  // fetch the record from the collection based on the query desired.
  cref.findOne( dbQuery, function(err, dbData)
  {
    // test for error and be sure we found the data record
    if(!err && dbData)
    {
//console.log('GET /client/:'+cid+' dbData('+JSON.stringify(dbData)+')');
      // set the return json as the record found
      retjson = dbData;
    }
    else
    { // query failed
      // log an error msg
      console.error('GET /client/:'+cid+' failed to get/read client record ('+cid+') from DB!');

      retjson = {};
      retjson.RC = _rcError;
      retjson.error = "Client record("+cid+") not found!";
    
      // set http status code
      statusCode = 404;   // 404 not found
    }

    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  });
  
  return;
});

//-----------------------------------------------------------------------------
// functions to get/fetch records from the collections
//-----------------------------------------------------------------------------
app.get('/clients', function (req, res) 
{
//  console.log("app.get(./clients function has been called.");

  var cref = helper.crefClient();
  var dbQuery = {};               // query used for looking up records in the collection

  // fetch records from the collection based on the query desired.
  cref.find(dbQuery).toArray( function(err, items) 
  {
    if(!err)
    {
      // send the http response message
      var retjson = {"RC":_rcOK};      // assume a good json response
      var statusCode = 200;            // assume valid http response code=200 (OK, good response)

      retjson.items = items;

      // send the http response message
      helper.httpJsonResponse(res,statusCode,retjson);
    }
  });

  return;
});

//-----------------------------------------------------------------------------
// Delete a client customer record
//-----------------------------------------------------------------------------
app.delete('/client/:cid', function(req, res) 
{
  var retjson = {"RC":_rcError};    // assume a error json response, assume delete failed
  var statusCode = 404;             // assume delete will fail, 404 record not found.

  // get the clientId (cid) parm that came in on the request
  // it comes in as a string and MUST be converted to a base10 integer
  var cid = parseInt(req.params.cid, 10);

  var cref = helper.crefClient();   // obtain the dhClient collection handle/refrence
  var dbQuery = {'clientId':cid};   // setup the query for locating the client record by cid

  // delete a record from the collection based on the query desired.
  // returns the record deleted.
  cref.findOneAndDelete( dbQuery, function(err, dbData)
  {
     // test for error and be sure we found the data record
     if(!err && dbData)
     {

       if( dbData.value != null )
       { // record found and the record is now deleted!

         // set the return json as the record found
         retjson = dbData;

         retjson.RC = _rcOK;
         retjson.success = 'Deleted client record (' + cid + ')!';

//console.log('DELETE /client/:'+cid+' retjson('+JSON.stringify(retjson)+')');

         // set http status code
         statusCode = 200;   // 200 status OK, good response
       }

     }

     // test if record delete failed, if statusCode != 200 then record delete failed.
     if( statusCode != 200 )
     { // delete failed
       // log an error msg
       console.error('DELETE /client/:'+cid+' failed to delete client record ('+cid+') from DB!');

       retjson = {};
       retjson.RC = _rcError;
       retjson.error = "Client record("+cid+") not deleted, possibly record not found!";

       // set http status code
       statusCode = 404;   // 404 not found
     }

     // send the http response message
     helper.httpJsonResponse(res,statusCode,retjson);
  });

  return;
});

//-----------------------------------------------------------------------------
// Create a new client customer record
//-----------------------------------------------------------------------------
app.post('/client', function (req, res) 
{
  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)
  var clientRecord = req.body;     // get the request body json data

  // add the client record to the DB
  _addClientRecord( clientRecord, function(result)
  {
     // send the http response message
     retjson.data = result; // put the record added in the reply
     retjson.success = "Created a new client record.";
     res.status(statusCode).json(retjson);
     res.end;
  });

  return;
});

//-----------------------------------------------------------------------------
// Update a client customer record
//-----------------------------------------------------------------------------
app.put('/client', function (req, res) 
{
  var retjson = {"RC":_rcError};    // assume an error json response, assume update failed
  var statusCode = 404;             // assume update will fail, 404 record not found.
  var clientRecord = req.body;      // get the request body json data

  _updateClientRecord( clientRecord, function(updatedRecord)
  {
    if( updatedRecord != null )
    { // record found and the record was updated!
      // set the return json .data as the record found
      retjson.data = updatedRecord;

      retjson.RC = _rcOK;
      retjson.success = 'Client record (' + updatedRecord.clientId + ') has been updated!';

      // set http status code
      statusCode = 200;   // 200 status OK, good response
    }
    else
    { // ERROR: record could not be updated
      retjson.error = "Client record(" + clientRecord.clientId + ") not updated, possibly record not found!";
      console.error('PUT /client : ' + retjson.error);
    }

    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  });

  return;
});

//-----------------------------------------------------------------------------
// Patch a client customer record
//-----------------------------------------------------------------------------
app.patch('/client', function (req, res) 
{
  var retjson = {"RC":_rcError};    // assume an error json response, assume update failed
  var statusCode = 404;             // assume update will fail, 404 record not found.
  var clientRecord = req.body;      // get the request body json data

  _updateClientRecord( clientRecord, function(updatedRecord)
  {
    if( updatedRecord != null )
    { // record found and the record was updated!
      // set the return json .data as the record found
      retjson.data = updatedRecord;

      retjson.RC = _rcOK;
      retjson.success = 'Client record (' + updatedRecord.clientId + ') has been updated!';

      // set http status code
      statusCode = 200;   // 200 status OK, good response
    }
    else
    { // ERROR: record could not be updated
      retjson.error = "Client record(" + clientRecord.clientId + ") not updated, possibly record not found!";
      console.error('PATCH /client : ' + retjson.error);
    }

    // send the http response message
    helper.httpJsonResponse(res,statusCode,retjson);
  });

  return;
});

//-----------------------------------------------------------------------------
// Simple echo get method, used to sanity test service
//-----------------------------------------------------------------------------
app.get('/echo', function (req, res) 
{
//  console.log("app.get(./echo function has been called.");

  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // send the http response message
  retjson.success = "Echo from DreamHome.dhClient service!";

  // send the http response message
  helper.httpJsonResponse(res,statusCode,retjson);

  return;
});


//-----------------------------------------------------------------------------
// Private function start here
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// adds a new client record to mongodb
//-----------------------------------------------------------------------------
function _addClientRecord(jsonRecord,callback)
{
//console.log("DEBUG1 - " + JSON.stringify(jsonRecord) );

  // get refrence handle to the Client collection
  var cref = helper.crefClient();

  // create and add the first client record to the Client collection.
  // generate a unique Client Id key for this real-estate client record
  helper.genClientId(
  function(err, pkId)
  {
    // add the unique clientId to the record
    jsonRecord.clientId = pkId;
//console.log("DEBUG2 - " + JSON.stringify(jsonRecord) );

    if(!err)
    { // pkId generated 
      // add the record to the DB clientCollection
      cref.insertOne( jsonRecord, {w:1, j:true},
      function(err,result)
      { 
        if(!err)
        {
//console.log("Client record "+pkId+" added to Client collection.");
          callback(jsonRecord); // return the full record added
        }
      });
    }
  });

  return;
}

//-----------------------------------------------------------------------------
// updates an existing client record in mongodb
//-----------------------------------------------------------------------------
function _updateClientRecord(jsonRecord,callback)
{
//console.log("DEBUG1 - " + JSON.stringify(jsonRecord) );

  var cref = helper.crefClient();   // obtain the dhClient collection handle/refrence
  var cid = jsonRecord.clientId;    // get the clientId from the record
  var dbQuery = {'clientId':cid};   // setup the query for locating the client record by cid

  // update the record
  cref.findOneAndUpdate( dbQuery, {$set: jsonRecord}, 
        {
          returnOriginal: false
          , upsert: false
        },
  function(err,result)
  { 
    var updatedRecord = null; // assume record will not be updated successfully, assume error 

    if(!err)
    { // no error
      var updatedRecord = result.value; // get the updated record, will be null if record not found!
    }

    callback(updatedRecord); // return the updated record, will return null if record not updated or not found
  });

  return;
}

//-----------------------------------------------------------------------------
// reads the request body data
//-----------------------------------------------------------------------------
//function _getReqBody(req,callback)
//{
//console.log("DEBUG1.1");
//  var body = [];
//  req.on('data', function(chunk) 
//  {
//console.log("DEBUG1.2");
//    body.push(chunk);
//  }).on('end', function() 
//  {
//console.log("DEBUG1.3");
//    body = Buffer.concat(body).toString();
//    callback(body);
//  });
//}

