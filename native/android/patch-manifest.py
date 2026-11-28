# Adds the Google sign-in deep link (com.sanadcompany.sanadorder://login-callback) to MainActivity,
# and the location permission used when a member saves a delivery location ("Use my current location").
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
if 'login-callback' not in s:
    filt = '''
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.sanadcompany.sanadorder" android:host="login-callback" />
            </intent-filter>
'''
    # insert right before the closing tag of the MainActivity <activity> element
    s, n = re.subn(r'(<activity[^>]*\.MainActivity[\s\S]*?)(\s*</activity>)', lambda m: m.group(1) + filt + m.group(2), s, count=1)
    if n != 1:
        sys.exit('MainActivity not found in manifest')
    open(p, 'w', encoding='utf-8').write(s)
perms = ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION']
missing = [x for x in perms if x not in s]
if missing:
    lines = ''.join(f'    <uses-permission android:name="{x}" />\n' for x in missing)
    s = s.replace('</manifest>', lines + '</manifest>', 1)
    open(p, 'w', encoding='utf-8').write(s)
print('deep link + location permission ok')
