/**
 * Module Dependencies
 */

var querystring = require('querystring')
  , request = require('request')
  , url = require('url')
  ;

/**
 * @private
 */
var graphUrl             = 'https://graph.facebook.com'
  , oauthDialogUrl       = "http://www.facebook.com/dialog/oauth?"
  , oauthDialogUrlMobile = "http://m.facebook.com/dialog/oauth?"
  , noop = function () {}
  ;

function cleanUrl (url, token) {
  // add leading slash
  if (url.charAt(0) !== '/') url = '/' + url;

  // add access token to url
  if (token) {
    url += ~url.indexOf('?') ? '&' : '?';
    url += "access_token=" + token;
  }

  return graphUrl + url;
}

/**
 * Library version
 */
exports.version = '0.2.1';

/*
# Graph

this is our constructor, it accepts an accessToken

*/
function Graph (token) {
  if ( !(this instanceof Graph ) ) {
    return new Graph(token);
  }
  this.token = token;
};

/*
@private
*/
Graph.prototype._request = function(opts, callback) {
  var self = this;
  request(opts, function(err, res, body) {
    if (err) {
      callback({
        message: 'Error processing request'
      , exception: err
      }, null);
      return;
    }

    if (~res.headers['content-type'].indexOf('image')) {
      body = {
        image: true
      , location: res.headers.location
      };
    }

    self._end(body, callback);
  });
};

/*
@private
*/
Graph.prototype._end = function (body, callback) {
  callback = callback || noop;

  var json = typeof body === 'string' ? null : body
    , err  = null;

  if (!json) {
    try {

      // this accounts for `real` json strings
      if (~body.indexOf('{') && ~body.indexOf('}')) {
        json = JSON.parse(body);
      } else {
        // this accounts for responses that are plain strings
        // access token responses have format of "accesstoken=....&..."
        // but facebook has random responses that just return "true"
        // so we'll convert those to { data: true }
        if (!~body.indexOf('='))    body = 'data=' + body;
        if (body.charAt(0) !== '?') body = '?' + body;

        json = url.parse(body, true).query;
      }

    } catch (e) {
      err = {
          message: 'Error parsing json'
        , exception: e
      };
    }
  }

  if (!err && (json && json.error)) err = json.error;

  callback(err, json);
};


/*
Accepts an url an returns facebook
json data to the callback provided

if the response is an image
( FB redirects profile image requests directly to the image )
We'll send back json containing  {image: true, location: imageLocation }

Ex:

Passing params directly in the url:

    graph.get("zuck?fields=picture", callback)

OR

    var params = { fields: picture };
    graph.get("zuck", params, callback);

GraphApi calls that redirect directly to an image
will return a json response with relavant fields

    graph.get("/zuck/picture", callback);

returns:

    {
     image: true,
     location: "http://profile.ak.fbcdn.net/hprofile-ak-snc4/157340_4_3955636_q.jpg"
    }
 
@param  {String}   path of the requests
@param  {object}   eventual optional parameters
@param  {function} callback 
*/
Graph.prototype.get = function (path, data, callback) {
  if (typeof data === 'function') {
    callback = data;
    data   = null;
  }

  if (typeof path !== 'string') {
    return callback({ message: 'Graph api url must be a string' }, null);
  }

  if (data) path += '?' + querystring.stringify(data);

  this._request({
    url:            cleanUrl(path, this.token)
  , method:         'GET'
  , encoding:       'utf-8'
  , followRedirect: false
  }, callback);
};

/*
Publish to the facebook graph access token will be needed for posts

Ex:

    var wallPost = { message: "heyooo budday" };
    graph.post(friendID + "/feed", wallPost, callback);

@param {string} url
@param {object} postData
@param {function} callback
*/
Graph.prototype.post = function (path, data, callback) {
  if (typeof data === 'function') {
    callback = data;
    data     = null;
  }

  if (typeof path !== 'string') {
    return callback({ message: 'Graph api url must be a string' }, null);
  }

  this._request({
    url:            cleanUrl(path, this.token)
  , method:         'POST'
  , body:           querystring.stringify(data)
  , encoding:       'utf-8'
  , followRedirect: false
  }, callback);
  return this;
}

/*
Deletes an object from the graph api by sending a "DELETE", which is really
a post call, along with a method=delete param

@param {string} url
@param {function} callback
*/
Graph.prototype.del = function (url, callback) {
  this._request({
    url:            cleanUrl(graphUrl + url, this.token)
  , method:         'POST'
  , encoding:       'utf-8'
  , followRedirect: false
  }, callback);
};

/*
Simple wrapper for the Search Graph API

@param  {[type]}   query    [description]
@param  {Function} callback [description]
@return {[type]}
*/
Graph.prototype.search = function (query, callback) {
  var url = '/search?' + querystring.stringify(query);
  return this.get(url, callback);
};

/*
Perform a fql query or mutliquery multiqueries are done by sending in
an object:

    var query = {
      name:         "SELECT name FROM user WHERE uid = me()"
    , permissions:  "SELECT " + FBConfig.scope + " FROM permissions WHERE uid = me()"
    };

    graph.fql(query, function (err, data) { ... })

@param {string/object} query
@param {function} callback
*/
Graph.prototype.fql = function (query, callback) {
  var url = '/search?' + querystring.stringify(query);
  return this.get(url, callback);
};

// Node module exports
module.exports = Graph;

// sets graph url
exports.setGraphUrl = function (url) {
  graphUrl = url;
  return this;
};

// @returns the graphUrl
exports.getGraphUrl = function() {
  return graphUrl;
};


/*
@param {object} params containing:
  - client_id
  - redirect_uri
@param {object} opts  Options hash. { mobile: true } will return mobile oAuth URL
@returns the oAuthDialogUrl based on params
*/
exports.getOauthUrl = function (params, opts) {
  var url = (opts && opts.mobile) ? oauthDialogUrlMobile : oauthDialogUrl;
  return url + querystring.stringify(params);
};

/**
Authorizes user return a Graph object to the callback.

@param {object} params containing:
- client_id
- redirect_uri
- client_secret
- code

@param {function} callback
*/

exports.authorize = function (params, callback) {
  var self = this
    , graph = new Graph();

  gtaph.get("/oauth/access_token", params, function(err, res) {
    if (err) return callback(err);

    graph.token = res.access_token;
    callback(err, graph, res);
  });
};
