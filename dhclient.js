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
  var cid = req.params.cid;

  var cref = helper.crefClient();

  // fetch records from the collection based on the query desired.
  cref.findOne( {'clientId':cid}, function(err, dbData)
  {
     // test for error and be sure we found the data record
     if(!err)
     {
        retjson = dbData;

        // send the http response message
        helper.httpJsonResponse(res,statusCode,retjson);
     }
     else
     { // query failed
       // send the http response message
       var retjson = {"RC":_rcError};   // set RC to error
       var statusCode = 404;            // set http status code to 404 'Not Found'
       retjson.msg = "Cleint record (" + cid + ") not found!";
       retjson.err = err;

       // send the http response message
       helper.httpJsonResponse(res,statusCode,retjson);
     }
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
// Simple echo get method, used to sanity test service
//-----------------------------------------------------------------------------
app.get('/echo', function (req, res) 
{
//  console.log("app.get(./echo function has been called.");

  var retjson = {"RC":_rcOK};      // assume a good json response
  var statusCode = 200;            // assume valid http response code=200 (OK, good response)

  // send the http response message
  retjson.success = "Echo from DreamHome.dhClient service!";
  res.status(statusCode).json(retjson);
  res.end;

  return;
});


//-----------------------------------------------------------------------------
// Private function start here
//-----------------------------------------------------------------------------

