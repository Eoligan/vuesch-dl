import os
import re
import subprocess
import argparse
from pathlib import Path
from send2trash import send2trash  # Para enviar archivos a la papelera en lugar de eliminarlos


class VideoMerger:
    """Class to merge video and audio files from VueSchool downloads"""

    def __init__(self, input_dir=None):
        """Initialize the VideoMerger with the input directory"""
        self.input_dir = input_dir or os.path.join(os.getcwd(), 'downloads')
        # No longer using a separate output directory
        self.delete_originals = True  # Flag to control deletion of original files

    def find_video_audio_pairs(self, course_dir):
        """Find matching video and audio files in the course directory"""
        files = os.listdir(course_dir)
        video_files = []
        audio_files = []
        already_processed = []

        # Separate video and audio files and identify already processed files
        for file in files:
            if file.endswith('.mp4'):
                if 'audio' in file:
                    audio_files.append(file)
                elif 'fhls-fastly_skyfire' in file:
                    video_files.append(file)
                else:
                    # This could be an already processed file (without the fastly_skyfire pattern)
                    already_processed.append(file)

        # Match video and audio files based on lesson number and name
        pairs = []
        skipped_count = 0
        for video_file in video_files:
            # Extract lesson number and name from video filename
            match = re.match(r'^(\d+)-(.*?)\.fhls-fastly_skyfire-\d+\.mp4$', video_file)
            if not match:
                continue

            lesson_num, lesson_name = match.groups()
            # Find matching audio file by lesson number and name
            # Using a more flexible approach to match any audio file variant
            matching_audio_files = [af for af in audio_files if af.startswith(f"{lesson_num}-{lesson_name}")]
            
            # Check if output file already exists
            output_filename = f"{lesson_num}-{lesson_name}.mp4"
            output_path = os.path.join(course_dir, output_filename)
            
            if os.path.exists(output_path):
                skipped_count += 1
                continue  # Skip this pair as it's already been processed
            
            if matching_audio_files:
                # Use the first matching audio file
                audio_file = matching_audio_files[0]
                pairs.append({
                    'video': os.path.join(course_dir, video_file),
                    'audio': os.path.join(course_dir, audio_file),
                    'output': output_path
                })
        
        if skipped_count > 0:
            print(f"Se omitieron {skipped_count} archivos que ya fueron procesados anteriormente.")

        return pairs

    def merge_files(self, video_path, audio_path, output_path):
        """Merge video and audio files using FFmpeg"""
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        try:
            # Use FFmpeg to merge the files
            cmd = [
                'ffmpeg',
                '-i', video_path,  # Video input
                '-i', audio_path,  # Audio input
                '-c:v', 'copy',    # Copy video codec without re-encoding
                '-c:a', 'aac',     # Use AAC for audio
                '-strict', 'experimental',
                '-map', '0:v:0',   # Use first video stream from first input
                '-map', '1:a:0',   # Use first audio stream from second input
                '-shortest',       # Finish encoding when the shortest input stream ends
                '-y',              # Overwrite output files without asking
                output_path
            ]
            
            print(f"Procesando: {os.path.basename(output_path)}")
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error merging files: {e}")
            return False
        except Exception as e:
            print(f"Unexpected error: {e}")
            return False

    def process_course(self, course_name=None):
        """Process a specific course or all courses if none specified"""
        if course_name:
            # Process a specific course
            course_dir = os.path.join(self.input_dir, course_name)
            if not os.path.isdir(course_dir):
                print(f"Course directory not found: {course_dir}")
                return False
            
            return self._process_single_course(course_dir)
        else:
            # Process all courses in the input directory
            success = True
            for item in os.listdir(self.input_dir):
                course_dir = os.path.join(self.input_dir, item)
                if os.path.isdir(course_dir):
                    if not self._process_single_course(course_dir):
                        success = False
            
            return success

    def _process_single_course(self, course_dir):
        """Process a single course directory"""
        print(f"Curso: {os.path.basename(course_dir)}")
        pairs = self.find_video_audio_pairs(course_dir)
        
        if not pairs:
            print(f"No se encontraron pares de video/audio en {os.path.basename(course_dir)}")
            return False
        
        success = True
        successful_pairs = []
        
        for pair in pairs:
            if self.merge_files(pair['video'], pair['audio'], pair['output']):
                successful_pairs.append(pair)
            else:
                success = False
        
        # Only delete original files if all merges were successful and deletion is enabled
        if success and self.delete_originals and successful_pairs:
            self._delete_original_files(successful_pairs)
        
        return success


    def _delete_original_files(self, successful_pairs):
        """Envía los archivos originales de video y audio a la papelera de reciclaje después de una fusión exitosa"""
        for pair in successful_pairs:
            try:
                send2trash(pair['video'])
                send2trash(pair['audio'])
            except Exception as e:
                print(f"Error al enviar archivos originales a la papelera: {e}")


def main():
    """Main function to run the script from command line"""
    parser = argparse.ArgumentParser(description='Merge video and audio files from VueSchool downloads')
    parser.add_argument('-i', '--input', help='Input directory containing course folders')
    parser.add_argument('-c', '--course', help='Specific course to process')
    parser.add_argument('-k', '--keep', action='store_true', help='Keep original files after merging')
    args = parser.parse_args()
    
    merger = VideoMerger(input_dir=args.input)
    if args.keep:
        merger.delete_originals = False
    
    success = merger.process_course(course_name=args.course)
    
    if success:
        print("Procesamiento completado.")
    else:
        print("Algunos archivos no pudieron ser procesados.")


if __name__ == '__main__':
    main()