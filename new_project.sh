#!/bin/bash

name=$1

if [ "$1" = "" ] ; then
    echo "What do you want to use for a folder name?"
    read name
fi

if echo $name | grep -Eq '^[a-zA-Z0-9][-_a-zA-Z0-9]*$' ; then
    if [ -e "$name" ] ; then
        echo "A project with this name already exists."
    else
        echo "Creating the project in /$name/"
        cp -r .base_files $name
        cd $name
        vi "build.json"
    fi
else
    if echo $name | grep -Eq '^[^a-zA-Z0-9]' ; then
        echo "Your folder must start with an alphanumeric character."
    else
        echo "Your folder name can only contain alphanumeric characters, '-' or '_'."
    fi
fi

