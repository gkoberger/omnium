import json, os, os.path, shutil, sys, re

from subprocess import Popen, PIPE

#TODO: pep8-ize

folder = ""
settings = None
targets = ["jetpack", "greasemonkey"]

def _get_files(target):
    files = []

    # Use the user specified loading order.
    if 'load_order' in settings and settings['load_order']:
        for fname in settings['load_order']:
            if fname.endswith('js') or fname.endswith('css'):
                files.append(fname)

    # If none is specified, do it ourselves.
    else:
        # TODO: This should be sorted per the README.
        dirList = os.listdir('includes')
        for fname in dirList:
            if fname.endswith('js') or fname.endswith('css'):
                files.append(fname)

    files_clean = []
    # Strip out targeted files for other targets.
    for f in files:
        for t in targets:
            if f.startswith('%s_' % t) and target != t:
                break
        files_clean.append(f)

    return files_clean

def greasemonkey():
    files = _get_files("greasemonkey")

    os.makedirs('%s/output/greasemonkey/' % folder)

    output = '%s/output/greasemonkey/%s.user.js' % (folder, folder)

    print 'GENERATING GREASEMONKEY SCRIPT'

    with open(output, 'w') as o:
        print '  Creating userscript skeleton...'

        settings_extended = settings

        included_urls = ""
        for url in settings_extended['included_urls']:
            included_urls += '// @include       %s\n' % url
        settings_extended['includes'] = included_urls

        excluded_urls = ""
        # TODO: Implement excluded
        settings_extended['excludes'] = excluded_urls

        with open(".builder/greasemonkey/header.js") as header:
            o.write(header.read() % settings_extended)

        print '  Adding files...'
        # Bootstrap file
        with open('.builder/omnium_bootstrap.js') as bootstrap:
            o.write(bootstrap.read())
            print '  + omnium_bootstrap.js'

        # User created files
        for f in files:
            if f.endswith('.js'):
                with open('%s/includes/%s' % (folder, f)) as fh:
                    data = fh.read() + '\n'
                    o.write(data)
            elif f.endswith('.css'):
                with open('%s/includes/%s' % (folder, f)) as fh:
                    css = compress_css(fh.read())
                    #TODO: this won't work with single quotes!
                    o.write("omnium_addCss('%s');" % css)

            print '  + %s' % f

    print ''
    print '  Outputted to %s!' % output
    print ''
    print ''

    o.close()

def jetpack():
    print 'GENERATING JETPACK SCRIPT'
    print '  Copying scripts...'

    # TODO: Make sure this is always lowercase

    # Create the folder (use `_` to avoid collision).
    jp_folder = '.builder/jetpack-sdk/_%s/' % folder
    os.makedirs(jp_folder)
    os.makedirs('%s/data/' % jp_folder)
    os.makedirs('%s/lib' % jp_folder)
    os.makedirs('%s/tests' % jp_folder)

    os.makedirs('%s/output/jetpack/' % folder)

    # Copy bootstrap.js
    shutil.copyfile('.builder/omnium_bootstrap.js', '%s/data/omnium_bootstrap.js' % jp_folder)
    print '  + omnium_bootstrap.js'

    # Copy all scripts to builder/jetpack/___/data
    files = _get_files("jetpack")

    #TODO: Deal with the user using subfolders. Loops and recursion!
    for f in files:
        if f.endswith('.js'):
            shutil.copyfile('%s/includes/%s' % (folder, f), '%s/data/%s' % (jp_folder, f))
        elif f.endswith('.css'):
            with open('%s/includes/%s' % (folder, f)) as stylesheet_in:
                css = compress_css(stylesheet_in.read())
                with open('%s/data/%s' % (jp_folder, f), 'w') as stylesheet_out:
                    stylesheet_out.write("omnium_addCss('%s');" % css)
        print '  + %s' % f

    # Generate a build file
    print '  Creating basic build files...'
    # TODO: Don't allow quotes in author or description
    package_json = {}
    package_json['fullName'] = settings['name']
    package_json['description'] = settings['description']
    package_json['author'] = settings['author']

    if "jetpack_id" in settings:
        package_json['id'] = settings['jetpack_id']

    with open("%s/package.json" % jp_folder, 'w') as package_file:
        package_file.write(json.dumps(package_json, indent=4))
    print '  + package.json'

    # Create a main.js file

    included = "[%s]" % (', '.join(['"%s"' % url for url in settings['included_urls']]))
    # TODO: Deal with mulitple *'s in included URLs.
    files_include = ["omnium_bootstrap.js"] + files
    scripts = "[%s]" % (", ".join(["data.url(\"%s\")" % f for f in files_include]))

    main_vars = dict(included=included, scripts=scripts)
    with open(".builder/jetpack/main.js") as main_out:
        with open("%s/lib/main.js" % jp_folder, 'w') as main_in:
            main_in.write(main_out.read() % main_vars)
    print '  + main.js'

    def generate_xpi():
        os.chdir('.builder/jetpack-sdk/')
        p = Popen("source bin/activate; cfx xpi --pkgdir='_%s'" % folder, shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE)
        os.chdir('../..') # back to where we started

        # First time? We need to save the key and do it again.
        errors = p.stderr.read()
        error_noid = re.compile("No 'id' in package.json")

        if error_noid.findall(errors):
            # We need to save the ID for next time
            print "  + Creating a new key (first run)"

            with open('_%s/package.json' % folder) as json_file:
                package_json = json.load(json_file)
                with open('../../%s/build.json' % folder, 'r+') as build_file:
                    build_json = json.load(build_file)
                    build_json['jetpack_id'] = package_json['id']

                    build_file.seek(0)
                    build_file.write(json.dumps(build_json, indent=4))
            #TODO: This could get us into an infinite loop..
            generate_xpi()
        else:
            # TODO: This assumes no errors, which is way too optomistic
            print '  + Generated xpi'

            shutil.copyfile('.builder/jetpack-sdk/_%s.xpi' % folder, '%s/output/jetpack/%s.xpi' % ((folder,)*2))
            print '  + Copied to %s.xpi' % folder

    # Generate using the sdk
    print '  Generating XPI...'

    generate_xpi()

    print ''
    print '  Outputted to %s/output/jetpack/%s.xpi!' % (folder, folder)
    print ''
    print ''

def compress_css(css):
    # Based on http://stackoverflow.com/questions/222581/python-script-for-minifying-css

    # remove comments - this will break a lot of hacks :-P
    css = re.sub( r'\s*/\*\s*\*/', "$$HACK1$$", css ) # preserve IE<6 comment hack
    css = re.sub( r'/\*[\s\S]*?\*/', "", css )
    css = css.replace( "$$HACK1$$", '/**/' ) # preserve IE<6 comment hack

    # url() doesn't need quotes
    css = re.sub( r'url\((["\'])([^)]*)\1\)', r'url(\2)', css )

    # spaces may be safely collapsed as generated content will collapse them anyway
    css = re.sub( r'\s+', ' ', css )

    # shorten collapsable colors: #aabbcc to #abc
    css = re.sub( r'#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3(\s|;)', r'#\1\2\3\4', css )

    # fragment values can loose zeros
    css = re.sub( r':\s*0(\.\d+([cm]m|e[mx]|in|p[ctx]))\s*;', r':\1;', css )

    output = ""
    for rule in re.findall( r'([^{]+){([^}]*)}', css ):

        # we don't need spaces around operators
        selectors = [re.sub( r'(?<=[\[\(>+=])\s+|\s+(?=[=~^$*|>+\]\)])', r'', selector.strip() ) for selector in rule[0].split( ',' )]

        # order is important, but we still want to discard repetitions
        properties = {}
        porder = []
        for prop in re.findall( '(.*?):(.*?)(;|$)', rule[1] ):
            key = prop[0].strip().lower()
            if key not in porder: porder.append( key )
            properties[ key ] = prop[1].strip()

        # output rule if it contains any declarations
        if properties:
            output += ("%s{%s}" % ( ','.join( selectors ),
                ''.join(['%s:%s;' % (key, properties[key]) for key in porder])[:-1]
                ))

    return output


def main():
    # Remove the output.
    shutil.rmtree('%s/output' % folder, True)

    # We may not want to do this...
    jp_folder = '.builder/jetpack-sdk/_%s' % folder
    shutil.rmtree(jp_folder, True)

    greasemonkey()
    jetpack()

if __name__ == '__main__':
    folder = sys.argv[1]
    settings = json.load(open('%s/build.json' % folder))
    main()


