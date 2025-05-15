# NemoPresetExt
A Sillytavern extension for creating drop downs for ChatCompletion presets.

The way it works is that you create a prompt entry with a identifier by default it is = the regex (which can be customized) will then turn that entry into a collection, with every entry below it being contained with in. In order to make groups, place another identifer prompt below it, which will then group for example. 

===Group1===
Item1
Item2
item3
===Group2===
Item4
item5
item6
Etc.

You can freely change the regex using the settings provided. Simply add the character you'd like to use. (Currently I'm not saving this because I completely forgot to do that... so... ugh... more to come I guess.)
