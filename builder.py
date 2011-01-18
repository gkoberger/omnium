import json, os, os.path, shutil, sys, re

folder = ""
settings = None
targets = ["jetpack", "userscript"]

def _get_files(target):
    files = []

    # Use the user specified loading order.

    print folder

    if settings['load_order']:
        for fname in settings['load_order']:
            if fname.endswith('js'):
                files.append('js/%s' % fname.split('/')[-1])
            elif fname.endswith('css'):
                files.append('css/%s' % fname.split('/')[-1])

    # If none is specified, do it ourselves.
    else:
        # This should be sorted per the README.
        dirList = os.listdir('css')
        for fname in dirList:
            files.append('css/%s' % fname)
        dirList = os.listdir('js')
        for fname in dirList:
            files.append('js/%s' % fname)

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

    o = open(output, 'w')
    print 'GENERATING GREASEMONKEY SCRIPT'
    print '  Creating userscript skeleton'
    print '  Adding scripts...'
    for f in scripts:
        fh = open('src/js/%s' % f)
        data = fh.read() + '\n'
        fh.close()

        o.write(data)
        print '   + %s' % f

    print '  Adding stylesheets...'
    for f in stylesheets:

        fh = open('src/css/%s' % f)
        css = compress_css(fh.read())
        fh.close()

        o.write("$('<style type=text/css>').appendTo($('head')).html('%s');" %
                 css)

        print '  + %s' % f

    print ''
    print '  Outputted to %s!' % output
    print ''
    print ''

    o.close()

def jetpack(scripts, stylesheets):
    print 'GENERATING JETPACK SCRIPT'
    print '  Copying scripts...'

    if os.path.exists('output/jetpack/data'):
        shutil.rmtree('output/jetpack/data')
    os.makedirs('output/jetpack/data/')

    if os.path.exists('output/jetpack/lib'):
        shutil.rmtree('output/jetpack/lib')
    os.makedirs('output/jetpack/lib/')

    for f in scripts:
        shutil.copyfile('src/js/%s' % f, 'output/jetpack/data/%s' % f)
        print '   + %s' % f

    print '  Adding stylesheets...'
    o = open("output/jetpack/data/style.js", "a")
    for f in stylesheets:
        fh = open('src/css/%s' % f)
        css = compress_css(fh.read())
        fh.close()

        o.write("$('<style type=text/css>').appendTo($('head')).html('%s');" %
                 css)

        print '  + %s' % f

    scripts_all = scripts + ['style.js']
    includes = "[%s]" % (", ".join(["data.url(\"%s\")" % f for f in scripts_all]))

    print '  Creating files...'
    print '   + lib/main.js'
    o = open("output/jetpack/lib/main.js","a")
    for line in open("src/js/jetpack-main.js"):
        line = line.replace("INCLUDE_JS", includes)
        o.write(line)
    o.close()

    print ''
    print ' Created jetpack script!'
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
    greasemonkey()
    jetpack()

if __name__ == '__main__':
    folder = sys.argv[1]
    settings = json.load(open('%s/build.json' % folder))
    main()


