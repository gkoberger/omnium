Installing Omnium for the first time
====================================

Make sure you have NodeJS 0.6+ installed (by running `node -v`).

Clone omnium:

    git clone git@github.com:gkoberger/omnium.git --recursive

Inside your new omnium folder, install the dependencies:

    npm install
    
Make sure new_project.sh has the right permission:

    chmod u+x new_project.sh
    
Creating an add-on
==================

Steps to create a cross browser plugin:

  1. Create a new project folder.
     `./new_project.sh`
  2. Fill out the build.json file.
  3. Add .js and .css files to `/includes/` (Note: if you need them to be loaded
     in a particular order, use `load_order` in build.json)
  4. Run the build command from the main directory.
     `./builder.js [project name]`

Right now it's fragile and a lot won't work- this is only v0.1.

Currently only supports Greasemonkey (Fx3.6) and Jetpack (Fx4+). Chrome support coming soon.

For a good example using all of the features, see [gkoberger/bugzillajs](http://github.com/gkoberger/bugzillajs).

Questions?
==========
This is woefully underdocumented, so post absolutely any questions in Issues and we'll answer them :)

Or, email us:
  * gkoberger [at] gmail [dot] com
  * mdeboer [at] mozilla [dot] com

Troubleshooting:
================

- Make sure you have NodeJS 0.6+ installed (available from various package managers or http://nodejs.org/)
- Run `npm install` after you've cloned omnium
- Make sure new_project.sh has the proper permissions (`chmod u+x new_project.sh`)
- Probably only works in OSX right now
- Make sure you init and update the submodules
- Jetpack .xpi's will only run in Fx4+; 3.6 requires Greasemonkey
- A majority of errors will be because of weird jetpack stuff; try running
  the jetpack stuff inside .builder/jetpack-sdk manually.  Eventually most
  of these problems will go away.
