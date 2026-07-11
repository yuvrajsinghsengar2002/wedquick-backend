# cPanel Passenger entry point
# cPanel's Node.js App Manager requires this exact filename: app.js at root level
# It just loads our actual app from src/

require('./src/app.js');
