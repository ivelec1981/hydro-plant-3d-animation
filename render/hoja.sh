#!/bin/bash
# hoja de contacto 2x2 de cuatro fotogramas: render/hoja.sh salida.png f1 f2 f3 f4
out=$1; shift
ffmpeg -y -loglevel error -i f$(printf %05d $1).png -i f$(printf %05d $2).png -i f$(printf %05d $3).png -i f$(printf %05d $4).png -filter_complex "[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0,scale=1920:1080:flags=lanczos" $out
